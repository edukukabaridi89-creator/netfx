import { ComponentProps, ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import RootStore from '@/stores/root-store';
import { LegacyLogout1pxIcon, LegacyTheme1pxIcon } from '@deriv/quill-icons/Legacy';
import { useTranslations } from '@deriv-com/translations';
import { ToggleSwitch } from '@deriv-com/ui';

export type TSubmenuSection = 'accountSettings' | 'cashier' | 'reports';

//IconTypes
type TMenuConfig = {
    LeftComponent: React.ElementType;
    RightComponent?: ReactNode;
    as: 'a' | 'button';
    href?: string;
    label: ReactNode;
    onClick?: () => void;
    removeBorderBottom?: boolean;
    submenu?: TSubmenuSection;
    target?: ComponentProps<'a'>['target'];
    isActive?: boolean;
}[];

const BulkTraderIcon = () => (
    <svg width='16' height='16' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='4' y='10' width='32' height='6' rx='2' fill='currentColor' opacity='0.9' />
        <rect x='4' y='20' width='32' height='6' rx='2' fill='currentColor' opacity='0.6' />
        <rect x='4' y='30' width='32' height='6' rx='2' fill='currentColor' opacity='0.3' />
    </svg>
);
const HedgeHubIcon = () => (
    <svg width='16' height='16' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M8 20 L20 8 L32 20' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' opacity='0.9' />
        <path d='M8 20 L20 32 L32 20' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' opacity='0.5' />
        <circle cx='20' cy='20' r='3' fill='currentColor' />
    </svg>
);
const SpeedLabIcon = () => (
    <svg width='16' height='16' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M20 6 L14 22 L20 19 L20 34 L26 18 L20 21 Z' fill='currentColor' opacity='0.9' />
    </svg>
);

const useMobileMenuConfig = (
    client?: RootStore['client'],
    onLogout?: () => void,
    enableThemeToggle: boolean = true
) => {
    const { localize } = useTranslations();
    const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();
    const navigate = useNavigate();

    const menuConfig = useMemo((): TMenuConfig[] => {

        return [
            [
                {
                    as: 'button',
                    label: localize('Bulk Trader'),
                    LeftComponent: BulkTraderIcon,
                    onClick: () => navigate('/bulk-trader'),
                },
                {
                    as: 'button',
                    label: localize('Hedge Hub'),
                    LeftComponent: HedgeHubIcon,
                    onClick: () => navigate('/hedge-hub'),
                },
                {
                    as: 'button',
                    label: localize('Speed Lab'),
                    LeftComponent: SpeedLabIcon,
                    onClick: () => navigate('/speed-lab'),
                },
                // Conditionally include theme toggle based on brand config
                enableThemeToggle && {
                    as: 'button',
                    label: localize('Dark theme'),
                    LeftComponent: LegacyTheme1pxIcon,
                    RightComponent: <ToggleSwitch value={is_dark_mode_on} onChange={toggleTheme} />,
                },
            ].filter(Boolean) as TMenuConfig,
            [
                client?.is_logged_in &&
                    onLogout && {
                        as: 'button',
                        label: localize('Log out'),
                        LeftComponent: LegacyLogout1pxIcon,
                        onClick: onLogout,
                        removeBorderBottom: true,
                    },
            ].filter(Boolean) as TMenuConfig,
        ].filter(section => section.length > 0);
    }, [
        client,
        onLogout,
        is_dark_mode_on,
        toggleTheme,
        localize,
        navigate,
        enableThemeToggle,
    ]);

    // [AI] Check if menu has any items to determine if mobile menu should be shown
    const hasMenuItems = menuConfig.some(section => section.length > 0);
    // [/AI]

    return {
        config: menuConfig,
        // [AI] Return flag indicating if menu has any items
        hasMenuItems,
        // [/AI]
    };
};

export default useMobileMenuConfig;
