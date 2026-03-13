import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '@supabase/supabase-js';

import { Button, Card, Heading, PillTabs, Screen, Subheading } from '../components/ui';
import {
  classifyAnimal,
  fileUriToDataUrl,
  loadHistory,
  saveClassification,
  uploadImageToStorage,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import type { ClassificationResponse, HistoryItem } from '../types/classification';

type HomeTab = 'upload' | 'live' | 'history';

export const HomeScreen = ({ session }: { session: Session }) => {
  const [activeTab, setActiveTab] = useState<HomeTab>('upload');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [currentResult, setCurrentResult] = useState<ClassificationResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [working, setWorking] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await loadHistory(session.user.id));
    } catch (error) {
      Alert.alert('History error', error instanceof Error ? error.message : 'Unable to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void refreshHistory();
  }, [session.user.id]);

  const runClassification = async (asset: { uri: string; mimeType: string }, inferenceMode: 'auto' | 'llm_only') => {
    setWorking(true);
    try {
      const imageData = await fileUriToDataUrl(asset.uri, asset.mimeType);
      const result = await classifyAnimal({ imageData, inferenceMode });
      setCurrentResult(result);

      let publicImageUrl: string | null = null;
      try {
        publicImageUrl = await uploadImageToStorage({ uri: asset.uri, mimeType: asset.mimeType });
      } catch (uploadError) {
        console.warn('Storage upload failed:', uploadError);
      }

      try {
        await saveClassification({
          imageUrl: publicImageUrl,
          result,
          userId: session.user.id,
        });
      } catch (saveError) {
        console.warn('Save classification failed:', saveError);
      }

      await refreshHistory();
    } catch (error) {
      Alert.alert('Classification failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to upload an animal image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    const nextImage = { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
    setSelectedImage(nextImage);
    setCurrentResult(null);
  };

  const captureWithCamera = async () => {
    if (!cameraPermission?.granted) {
      const next = await requestCameraPermission();
      if (!next.granted) {
        Alert.alert('Permission required', 'Allow camera access to capture animal images.');
        return;
      }
    }

    if (!cameraRef) {
      Alert.alert('Camera not ready', 'Wait for the preview to load and try again.');
      return;
    }

    setWorking(true);
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.75,
      });

      if (!photo?.uri) throw new Error('No image was captured.');

      const asset = {
        uri: photo.uri,
        mimeType: 'image/jpeg',
      };

      setSelectedImage(asset);
      await runClassification(asset, 'auto');
    } catch (error) {
      Alert.alert('Camera capture failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.kicker}>Signed in as</Text>
          <Text style={styles.email}>{session.user.email ?? 'Authenticated user'}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <Card>
        <Heading>BreedVision for mobile</Heading>
        <Subheading>
          Use upload, camera capture, and classification history from the same Supabase backend that powers the web app.
        </Subheading>
        <PillTabs
          items={[
            { key: 'upload', label: 'Upload' },
            { key: 'live', label: 'Camera' },
            { key: 'history', label: 'History' },
          ]}
          active={activeTab}
          onChange={(key) => setActiveTab(key as HomeTab)}
        />
      </Card>

      {activeTab === 'upload' && (
        <Card>
          <Text style={styles.sectionTitle}>Upload an image</Text>
          <Subheading>Pick a cattle or buffalo image from the device and send it to the existing `classify-animal` function.</Subheading>
          <Button label="Choose from library" onPress={() => void pickImage()} variant="secondary" />
          {selectedImage && <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />}
          {selectedImage && (
            <Button
              label="Analyze image"
              onPress={() => void runClassification(selectedImage, 'llm_only')}
              loading={working}
            />
          )}
          {currentResult && <ResultCard result={currentResult} />}
        </Card>
      )}

      {activeTab === 'live' && (
        <Card>
          <Text style={styles.sectionTitle}>Camera capture</Text>
          <Subheading>Take a photo in Expo Go, then classify it through the same backend pipeline used by the web app.</Subheading>
          <View style={styles.cameraShell}>
            {cameraPermission?.granted ? (
              <CameraView style={styles.camera} facing={cameraFacing} ref={(ref) => setCameraRef(ref)} />
            ) : (
              <View style={styles.cameraFallback}>
                <Text style={styles.cameraFallbackText}>Camera permission is required to capture images.</Text>
              </View>
            )}
          </View>
          <View style={styles.row}>
            <Button label="Enable camera" onPress={() => void requestCameraPermission()} variant="secondary" />
            <Button
              label={cameraFacing === 'back' ? 'Use front camera' : 'Use back camera'}
              onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
              variant="ghost"
            />
          </View>
          <Button label="Capture and classify" onPress={() => void captureWithCamera()} loading={working} />
          {selectedImage && <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />}
          {currentResult && <ResultCard result={currentResult} />}
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Classification history</Text>
            <Pressable onPress={() => void refreshHistory()}>
              <Text style={styles.linkText}>Refresh</Text>
            </Pressable>
          </View>
          <Subheading>Your recent scans from the shared `classifications` table.</Subheading>
          {historyLoading ? (
            <Text style={styles.mutedText}>Loading history...</Text>
          ) : history.length ? (
            <View style={styles.historyList}>
              {history.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyMeta}>
                    <Text style={styles.historyBreed}>{item.breed}</Text>
                    <Text style={styles.historyType}>{item.type}</Text>
                  </View>
                  <Text style={styles.historyConfidence}>{item.confidence}% confidence</Text>
                  <Text style={styles.mutedText}>{new Date(item.timestamp).toLocaleString()}</Text>
                  {item.recommendations ? (
                    <Text style={styles.historyRecommendation}>{item.recommendations}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.mutedText}>No mobile or web classifications have been saved for this user yet.</Text>
          )}
        </Card>
      )}
    </Screen>
  );
};

const ResultCard = ({ result }: { result: ClassificationResponse }) => (
  <View style={styles.resultCard}>
    <View style={styles.resultHeader}>
      <Text style={styles.resultBreed}>{result.breed}</Text>
      <Text style={styles.resultConfidence}>{result.confidence}%</Text>
    </View>
    <Text style={styles.resultType}>{result.type}</Text>
    {result.recommendations ? <Text style={styles.resultBody}>{result.recommendations}</Text> : null}
    {result.extraInfo?.summary ? <Text style={styles.resultBody}>{result.extraInfo.summary}</Text> : null}
    <View style={styles.traitWrap}>
      {result.traits.slice(0, 6).map((trait) => (
        <View key={trait.name} style={styles.traitChip}>
          <Text style={styles.traitLabel}>{trait.name}</Text>
          <Text style={styles.traitScore}>{trait.score}/10</Text>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  hero: {
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kicker: {
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  email: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signOutText: {
    color: colors.text,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
  },
  cameraShell: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    height: 340,
    backgroundColor: colors.cardMuted,
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cameraFallbackText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resultCard: {
    marginTop: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#0a1d30',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  resultBreed: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  resultConfidence: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  resultType: {
    color: colors.primary,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  resultBody: {
    color: colors.textMuted,
    lineHeight: 21,
  },
  traitWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  traitChip: {
    minWidth: '47%',
    backgroundColor: colors.cardMuted,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  traitLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  traitScore: {
    color: colors.text,
    fontWeight: '700',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
  },
  mutedText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  historyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  historyBreed: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  historyType: {
    color: colors.primary,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  historyConfidence: {
    color: colors.accent,
    fontWeight: '700',
  },
  historyRecommendation: {
    color: colors.textMuted,
    lineHeight: 20,
  },
});
