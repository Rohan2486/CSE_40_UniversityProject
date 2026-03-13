import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../theme';

export const Screen = ({ children }: PropsWithChildren) => (
  <ScrollView
    contentContainerStyle={styles.screenContent}
    style={styles.screen}
    keyboardShouldPersistTaps="handled"
  >
    {children}
  </ScrollView>
);

export const Card = ({ children }: PropsWithChildren) => (
  <View style={styles.card}>{children}</View>
);

export const Heading = ({ children }: PropsWithChildren) => (
  <Text style={styles.heading}>{children}</Text>
);

export const Subheading = ({ children }: PropsWithChildren) => (
  <Text style={styles.subheading}>{children}</Text>
);

export const Input = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={colors.textMuted}
    secureTextEntry={secureTextEntry}
    autoCapitalize={autoCapitalize}
    style={styles.input}
  />
);

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  rightSlot,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  rightSlot?: ReactNode;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading}
    style={({ pressed }) => [
      styles.button,
      variant === 'secondary' && styles.buttonSecondary,
      variant === 'ghost' && styles.buttonGhost,
      variant === 'danger' && styles.buttonDanger,
      (disabled || loading) && styles.buttonDisabled,
      pressed && !disabled && !loading ? styles.buttonPressed : null,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={variant === 'ghost' ? colors.text : '#00101d'} />
    ) : (
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'ghost' && styles.buttonTextGhost,
        ]}
      >
        {label}
      </Text>
    )}
    {!loading && rightSlot}
  </Pressable>
);

export const PillTabs = ({
  items,
  active,
  onChange,
}: {
  items: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) => (
  <View style={styles.tabs}>
    {items.map((item) => {
      const isActive = item.key === active;
      return (
        <Pressable
          key={item.key}
          onPress={() => onChange(item.key)}
          style={[styles.tab, isActive && styles.tabActive]}
        >
          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{item.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subheading: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.cardMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: '#422029',
    borderWidth: 1,
    borderColor: '#6b2e3d',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: '#00101d',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: colors.text,
  },
  buttonTextGhost: {
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00101d',
  },
});
