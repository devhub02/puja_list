import { fireEvent, screen } from '@testing-library/react-native';

import appJson from '../app.json';
import SettingsScreen from '../app/(tabs)/settings';
import { renderThemed, resetSettings } from '../testing/utils';
import { useSettingsStore } from '@/store/settingsStore';
import { darkColors, lightColors, textSizeScale } from '@/theme/tokens';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: require('../app.json').expo.version } },
}));

const DISCLAIMER_HI =
  'विधि और सामग्री क्षेत्र, पारिवारिक परंपरा, सम्प्रदाय और पूजा करने के तरीके के अनुसार अलग हो सकती है। अपनी पारिवारिक परंपरा के अनुसार बदलाव करें।';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

beforeEach(() => resetSettings('en'));

describe('Settings screen', () => {
  it('shows version, about and the content disclaimer', async () => {
    await renderThemed(<SettingsScreen />);
    expect(screen.getByText('App version')).toBeTruthy();
    expect(screen.getByTestId('app-version').props.children).toBe(appJson.expo.version);
    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.getByTestId('disclaimer-body').props.children).toMatch(
      /Vidhi and samagri can differ by region, family tradition/,
    );
  });

  it('switches the language to Hindi and back, updating all visible text', async () => {
    await renderThemed(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('language-hi'));

    expect(useSettingsStore.getState().language).toBe('hi');
    expect(screen.getByText('सेटिंग्स')).toBeTruthy();
    expect(screen.getByText('अक्षरों का आकार')).toBeTruthy();
    expect(screen.getByTestId('disclaimer-body').props.children).toBe(DISCLAIMER_HI);

    await fireEvent.press(screen.getByTestId('language-en'));
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('switches the theme and restyles the screen', async () => {
    await renderThemed(<SettingsScreen />);
    const heading = () => flat(screen.getByText('Settings').props.style).color;
    expect(heading()).toBe(lightColors.heading);

    await fireEvent.press(screen.getByTestId('theme-dark'));
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    expect(heading()).toBe(darkColors.heading);

    await fireEvent.press(screen.getByTestId('theme-light'));
    expect(heading()).toBe(lightColors.heading);
  });

  it('changes the live preview size with the text size setting', async () => {
    await renderThemed(<SettingsScreen />);
    const bodySize = () => flat(screen.getByTestId('preview-body').props.style).fontSize;
    expect(bodySize()).toBe(16);

    await fireEvent.press(screen.getByTestId('textsize-extraLarge'));
    expect(useSettingsStore.getState().textSize).toBe('extraLarge');
    expect(bodySize()).toBe(Math.round(16 * textSizeScale.extraLarge));

    await fireEvent.press(screen.getByTestId('textsize-small'));
    expect(bodySize()).toBe(Math.round(16 * textSizeScale.small));
  });

  it('gives Devanagari text a taller line height than Latin text', async () => {
    await renderThemed(<SettingsScreen />);
    const latin = flat(screen.getByTestId('preview-body').props.style);
    await fireEvent.press(screen.getByTestId('language-hi'));
    const deva = flat(screen.getByTestId('preview-body').props.style);
    expect((deva.lineHeight as number) / (deva.fontSize as number)).toBeGreaterThan(
      (latin.lineHeight as number) / (latin.fontSize as number),
    );
    expect(deva.fontFamily).toBe('NotoSansDevanagari_400Regular');
  });

  it('exposes options as radio buttons with selected state and a 48dp target', async () => {
    await renderThemed(<SettingsScreen />);
    const option = screen.getByTestId('theme-system');
    expect(option.props.accessibilityRole).toBe('radio');
    expect(option.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('theme-dark').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(flat(option.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});
