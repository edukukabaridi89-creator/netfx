import { useNavigate, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Text } from '@deriv-com/ui';

const NavItem = ({ label, path }: { label: string; path: string }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === path;

    return (
        <button
            className={`app-header__nav-item ${isActive ? 'app-header__nav-item--active' : ''}`}
            onClick={() => navigate(path)}
        >
            <Text size='sm' weight={isActive ? 'bold' : 'normal'}>
                {label}
            </Text>
        </button>
    );
};

export const MenuItems = observer(() => {
    return (
        <div className='app-header__nav-menu'>
            <NavItem label='Bulk Trader' path='/bulk-trader' />
            <NavItem label='Hedge Hub' path='/hedge-hub' />
            <NavItem label='Speed Lab' path='/speed-lab' />
        </div>
    );
});

export const TradershubLink = observer(() => {
    return null;
});

type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};

(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
