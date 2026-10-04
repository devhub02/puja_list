import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <MaterialCommunityIcons name={focused ? active : inactive} size={26} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, textStyle } = useTheme();
  const label = textStyle('label');

  const screens = [
    { name: 'index', title: t('tabs.home'), icon: tabIcon('home-variant', 'home-variant-outline') },
    {
      name: 'library',
      title: t('tabs.library'),
      icon: tabIcon('book-open-page-variant', 'book-open-page-variant-outline'),
    },
    {
      name: 'preparation',
      title: t('tabs.preparation'),
      icon: tabIcon('clipboard-check-multiple', 'clipboard-check-multiple-outline'),
    },
    { name: 'settings', title: t('tabs.settings'), icon: tabIcon('cog', 'cog-outline') },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: label.fontFamily, fontSize: 12 },
        // Navigation chrome keeps a fixed size so four labels always fit on a 360dp screen.
        tabBarAllowFontScaling: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {screens.map((screen) => (
        <Tabs.Screen
          key={screen.name}
          name={screen.name}
          options={{
            title: screen.title,
            tabBarLabel: screen.title,
            tabBarAccessibilityLabel: screen.title,
            tabBarIcon: screen.icon,
          }}
        />
      ))}
    </Tabs>
  );
}
