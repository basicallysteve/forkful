import './toolbar.scss'
import { Link } from 'react-router-dom'
type MenuOption = {
    label: string;
    action: () => void;
    children?: MenuOption[];
    to?: string; // Optional for direct links
}

function ToolBar({ menuOptions }: { menuOptions?: MenuOption[] }) {

    function renderMenuOption(option: MenuOption) {
        const hasChildren = !!(option.children && option.children.length > 0)

        return (
            <div className="menu-option" key={option.label}>
                <button
                    type="button"
                    className="menu-option__trigger"
                    onClick={option.action}
                >
                    <span className="menu-option__label">{option.label}</span>
                    {hasChildren && <span className="menu-option__caret">▾</span>}
                </button>
                {hasChildren && (
                    <div className="submenu" role="menu">
                        {option.children!.map((childOption) => (
                            <Link
                                key={childOption.label}
                                className="submenu-option"
                                to={childOption.to || "#"}
                                onClick={childOption.action}
                            >
                                {childOption.label}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="toolbar">
            <h1 className="toolbar-title">My Cookbook</h1>
            <div className="menu">
                {menuOptions && menuOptions.map((option) => renderMenuOption(option))}
            </div>
        </div>
    )
}
export default ToolBar
