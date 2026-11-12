'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MegaMenu } from 'primereact/megamenu'
import type { MenuItem } from 'primereact/menuitem'
import ThemeToggle from './ThemeToggle'
import ThemedLogo from './ThemedLogo'

type MenuOption = {
    label: string;
    action?: () => void;
    children?: MenuOption[];
    to?: string;
    align?: 'right';
    avatar?: { url: string | null; initial: string };
}

function ToolBar({ menuOptions }: { menuOptions?: MenuOption[] }) {
    const [drawerOpen, setDrawerOpen] = useState(false)

    const leftOptions = menuOptions?.filter(o => o.align !== 'right') ?? []
    const rightOptions = menuOptions?.filter(o => o.align === 'right') ?? []

    function closeDrawer() {
        setDrawerOpen(false)
    }

    function toMegaItem(option: MenuOption): MenuItem {
        const hasChildren = !!(option.children && option.children.length > 0)
        const item: MenuItem = {
            label: option.label,
            className: option.align === 'right' ? 'menu-item--right' : undefined,
            url: hasChildren ? undefined : option.to,
            template: (_item, options) => {
                if (hasChildren) {
                    return (
                        <a
                            href="#"
                            className={`${options.className} menu-option__trigger`}
                            data-pc-section="action"
                            tabIndex={-1}
                            onClick={(e) => e.preventDefault()}
                        >
                            <span className="menu-option__label">{option.label}</span>
                            <span className="menu-option__caret" aria-hidden="true">▾</span>
                        </a>
                    )
                }
                return (
                    <Link
                        href={option.to || '#'}
                        className={`${options.className} menu-option__trigger`}
                        data-pc-section="action"
                        tabIndex={-1}
                        onClick={option.action}
                        title={option.avatar ? option.label : undefined}
                        aria-label={option.avatar ? option.label : undefined}
                    >
                        {option.avatar ? (
                            <span className="toolbar-avatar">
                                {option.avatar.url
                                    ? <img src={option.avatar.url} alt="" className="toolbar-avatar__img" />
                                    : <span className="toolbar-avatar__initial">{option.avatar.initial}</span>
                                }
                            </span>
                        ) : (
                            <span className="menu-option__label">{option.label}</span>
                        )}
                    </Link>
                )
            },
        }
        if (hasChildren) {
            item.items = [[{
                label: option.label,
                items: option.children!.map((child): MenuItem => ({
                    label: child.label,
                    url: child.to,
                    template: (_i, options) => (
                        <Link
                            href={child.to || '#'}
                            className={`${options.className} submenu-option`}
                            data-pc-section="action"
                            tabIndex={-1}
                            onClick={child.action}
                        >
                            {child.label}
                        </Link>
                    ),
                })),
            }]]
        }
        return item
    }

    function renderDrawerSection(option: MenuOption) {
        const hasChildren = !!(option.children && option.children.length > 0)

        return (
            <div className="drawer-section" key={option.label}>
                {hasChildren ? (
                    <>
                        <span className="drawer-section__heading">{option.label}</span>
                        {option.children!.map((child) => (
                            <Link
                                key={child.label}
                                href={child.to || '#'}
                                className="drawer-section__link drawer-section__link--child"
                                onClick={closeDrawer}
                            >
                                {child.label}
                            </Link>
                        ))}
                    </>
                ) : (
                    <Link
                        href={option.to || '#'}
                        className="drawer-section__link"
                        onClick={closeDrawer}
                    >
                        {option.label}
                    </Link>
                )}
            </div>
        )
    }

    const allDrawerOptions = [...leftOptions, ...rightOptions]

    return (
        <>
            <div className="toolbar">
                <Link href="/" className="toolbar-brand">
                    <ThemedLogo size={34} />
                    <div className="toolbar-title">
                        <span className="toolbar-name">EatForkful</span>
                        <span className="toolbar-tagline">Recipes worth repeating</span>
                    </div>
                </Link>

                {/* Desktop menu */}
                <MegaMenu
                    className="menu menu--desktop"
                    model={[...leftOptions, ...rightOptions].map(toMegaItem)}
                    aria-label="Main navigation"
                    end={<ThemeToggle />}
                />

                {/* Mobile controls */}
                <div className="toolbar-mobile-controls">
                    <ThemeToggle />
                    <button
                        type="button"
                        className="hamburger"
                        aria-label="Open navigation menu"
                        aria-expanded={drawerOpen}
                        onClick={() => setDrawerOpen(true)}
                    >
                        <i className="pi pi-bars" />
                    </button>
                </div>
            </div>

            {/* Mobile drawer */}
            {drawerOpen && (
                <div
                    className="drawer-backdrop"
                    aria-hidden="true"
                    onClick={closeDrawer}
                />
            )}
            <nav
                className={`drawer${drawerOpen ? ' drawer--open' : ''}`}
                aria-label="Navigation menu"
            >
                <div className="drawer__header">
                    <span className="drawer__title">Menu</span>
                    <button
                        type="button"
                        className="drawer__close"
                        aria-label="Close navigation menu"
                        onClick={closeDrawer}
                    >
                        ✕
                    </button>
                </div>
                <div className="drawer__body">
                    {allDrawerOptions.map(renderDrawerSection)}
                </div>
            </nav>
        </>
    )
}

export default ToolBar
