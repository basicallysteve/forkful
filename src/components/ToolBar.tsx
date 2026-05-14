'use client'

import Link from 'next/link'
import { MegaMenu } from 'primereact/megamenu'
import type { MenuItem } from 'primereact/menuitem'

type MenuOption = {
    label: string;
    action?: () => void;
    children?: MenuOption[];
    to?: string; // Optional for direct links
}

const logoSrc = "/forkful-logo.svg"

function ToolBar({ menuOptions }: { menuOptions?: MenuOption[] }) {

    function toMenuItem(option: MenuOption): MenuItem {
        const hasChildren = !!(option.children?.length)
        const item: MenuItem = {
            label: option.label,
            items: hasChildren ? [option.children!.map(toMenuItem)] : undefined,
        }

        if (option.to) {
            item.template = () => (
                <Link href={option.to!} className="p-menuitem-link" onClick={option.action}>
                    <span className="p-menuitem-text">{option.label}</span>
                    {hasChildren && <span className="p-submenu-icon">▾</span>}
                </Link>
            )
        } else if (option.action) {
            item.command = () => option.action!()
        }

        return item
    }

    const model: MenuItem[] = (menuOptions ?? []).map(toMenuItem)

    const start = (
        <div className="toolbar-brand">
            <img src={logoSrc} alt="Forkful logo" className="toolbar-logo" />
            <div className="toolbar-title">
                <span className="toolbar-name">Forkful</span>
                <span className="toolbar-tagline">Recipes worth repeating</span>
            </div>
        </div>
    )

    return (
        <MegaMenu model={model} start={start} className="toolbar" />
    )
}

export default ToolBar
