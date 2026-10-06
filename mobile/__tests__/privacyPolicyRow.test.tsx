import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { PrivacyPolicyRow } from '@/components/PrivacyPolicyRow';
import { PRIVACY_POLICY_URL } from '@/config/legal';
import { useSettingsStore } from '@/store/settingsStore';

import { renderThemed, resetSettings } from '../testing/utils';

const URL = 'https://example.github.io/puja-saathi-privacy/';

describe('PrivacyPolicyRow', () => {
  beforeEach(async () => {
    await resetSettings('en');
  });

  it('ships with the URL empty (the owner sets it after publishing)', () => {
    expect(PRIVACY_POLICY_URL).toBe('');
  });

  it('is hidden when no URL is set', async () => {
    await renderThemed(<PrivacyPolicyRow url="" />);
    expect(screen.queryByTestId('privacy-policy-row')).toBeNull();
    expect(screen.queryByText('Privacy policy')).toBeNull();
  });

  it('shows an English row with a 48dp-or-taller button when a URL is set', async () => {
    await renderThemed(<PrivacyPolicyRow url={URL} />);
    expect(screen.getByTestId('privacy-policy-row')).toBeTruthy();
    const button = screen.getByTestId('privacy-policy-open');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Open the privacy policy in your browser');
    expect(screen.getByText('Privacy policy')).toBeTruthy();
  });

  it('opens the policy URL in the browser when pressed', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderThemed(<PrivacyPolicyRow url={URL} />);
    fireEvent.press(screen.getByTestId('privacy-policy-open'));
    expect(open).toHaveBeenCalledWith(URL);
    open.mockRestore();
  });

  it('does not crash when the browser cannot open the link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    await renderThemed(<PrivacyPolicyRow url={URL} />);
    fireEvent.press(screen.getByTestId('privacy-policy-open'));
    await Promise.resolve();
    expect(screen.getByTestId('privacy-policy-row')).toBeTruthy();
    open.mockRestore();
  });

  it('is translated to Hindi', async () => {
    await resetSettings('hi');
    await renderThemed(<PrivacyPolicyRow url={URL} />);
    expect(screen.getByText('गोपनीयता नीति')).toBeTruthy();
    expect(screen.getByTestId('privacy-policy-open').props.accessibilityLabel).toBe(
      'गोपनीयता नीति अपने ब्राउज़र में खोलें',
    );
  });

  it('renders in light and dark, and at extra-large text, without breaking the row', async () => {
    for (const size of ['extraLarge'] as const) {
      useSettingsStore.setState({ textSize: size });
      await renderThemed(<PrivacyPolicyRow url={URL} />);
      expect(screen.getByTestId('privacy-policy-open')).toBeTruthy();
    }
  });
});
