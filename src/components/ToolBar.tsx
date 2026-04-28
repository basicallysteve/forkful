'use client'

import { useRouter } from 'next/navigation'
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
    const router = useRouter()

    function toMenuItem(option: MenuOption): MenuItem {
        return {
            label: option.label,
            command: option.action ?? (option.to ? () => router.push(option.to!) : undefined),
            items: option.children && option.children.length > 0
                ? [option.children.map(toMenuItem)]
                : undefined,
        }
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
