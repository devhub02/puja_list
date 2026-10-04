import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Puja Saathi
      </Text>
      <Text style={styles.tagline}>Har Puja Ki Samagri, Vidhi Aur Taiyari</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.cream,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.maroon,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 12,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
});
