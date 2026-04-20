import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps {
  onPress?: (e: GestureResponderEvent) => void;
  selected?: boolean;
  accent?: string;
  accentRgb?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children?: React.ReactNode;
  testID?: string;
  hitSlop?: number;
  pressScale?: number;
  glow?: boolean;
  fillOnSelect?: boolean;
  borderRadius?: number;
}

export function AnimatedButton({
  onPress,
  selected = false,
  accent = '#8B5CF6',
  accentRgb = '139, 92, 246',
  style,
  disabled,
  children,
  testID,
  hitSlop,
  pressScale = 0.96,
  glow = true,
  fillOnSelect = true,
  borderRadius = 14,
}: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: selected ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [selected, fill]);

  useEffect(() => {
    if (!selected || !glow) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [selected, glow, pulse]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: pressScale,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 14,
    }).start();
  };

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      testID={testID}
      hitSlop={hitSlop}
      style={[{ transform: [{ scale }] }, style]}
    >
      {glow && selected && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -3,
              left: -3,
              right: -3,
              bottom: -3,
              borderRadius: borderRadius + 3,
              opacity: pulseOpacity,
              shadowColor: accent,
              shadowOpacity: 0.95,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
            },
            Platform.OS === 'web' && ({ boxShadow: `0 0 12px ${accent}aa, 0 0 28px ${accent}55` } as any),
          ]}
        />
      )}
      {fillOnSelect && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius,
              backgroundColor: `rgba(${accentRgb}, 0.18)`,
              opacity: fill,
              borderWidth: 1,
              borderColor: accent,
            },
          ]}
        />
      )}
      {children}
    </AnimatedPressable>
  );
}

export default AnimatedButton;
