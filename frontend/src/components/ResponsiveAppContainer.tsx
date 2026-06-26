import React, { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  /** Use a smaller measure for focused content such as authentication forms. */
  maxWidth?: number;
  /** Public, cinematic screens can intentionally use the full browser width. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Keeps JOIN feeling like a mobile app when it is viewed in a desktop browser.
 * On phones it remains full-width; on web it becomes a centered, readable column.
 */
export default function ResponsiveAppContainer({ children, maxWidth = 520, fullWidth = false, style }: Props) {
  return (
    <View
      style={[
        styles.container,
        Platform.OS === 'web' && !fullWidth && { maxWidth },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
