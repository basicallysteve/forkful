import './toolbar.scss'
import { Link } from 'react-router-dom'
type MenuOption = {
    label: string;
    action: () => void;
    children?: MenuOption[];
    to?: string; // Optional for direct links
}

const logoSrc = "/forkful-logo.svg"

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
            <div className="toolbar-brand">
                <img src={logoSrc} alt="Forkful logo" className="toolbar-logo" />
                <div className="toolbar-title">
                    <span className="toolbar-name">Forkful</span>
                    <span className="toolbar-tagline">Recipes worth repeating</span>
                </div>
            </div>
            <div className="menu">
                {menuOptions && menuOptions.map((option) => renderMenuOption(option))}
            </div>
        </div>
    )
}
export default ToolBar
