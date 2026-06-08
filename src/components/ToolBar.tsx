'use client'

import { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

type MenuOption = {
    label: string;
    action?: () => void;
    children?: MenuOption[];
    to?: string;
    align?: 'right';
    avatar?: { url: string | null; initial: string };
}

const logoSrc = "/forkful-logo.svg"

function ToolBar({ menuOptions }: { menuOptions?: MenuOption[] }) {
    const [drawerOpen, setDrawerOpen] = useState(false)

    const leftOptions = menuOptions?.filter(o => o.align !== 'right') ?? []
    const rightOptions = menuOptions?.filter(o => o.align === 'right') ?? []

    function closeDrawer() {
        setDrawerOpen(false)
    }

    function renderMenuOption(option: MenuOption) {
        const hasChildren = !!(option.children && option.children.length > 0)

        return (
            <div className={`menu-option${option.align === 'right' ? ' menu-option--right' : ''}`} key={option.label}>
                {hasChildren ? (
                    <button
                        type="button"
                        className="menu-option__trigger"
                        onClick={option.action}
                    >
                        <span className="menu-option__label">{option.label}</span>
                        <span className="menu-option__caret">▾</span>
                    </button>
                ) : (
                    <Link
                        href={option.to || '#'}
                        className="menu-option__trigger"
                        onClick={option.action}
                        title={option.avatar ? option.label : undefined}
                    >
                        {option.avatar ? (
                            <span className="toolbar-avatar" aria-label={option.label}>
                                {option.avatar.url
                                    ? <img src={option.avatar.url} alt={option.label} className="toolbar-avatar__img" />
                                    : <span className="toolbar-avatar__initial">{option.avatar.initial}</span>
                                }
                            </span>
                        ) : (
                            <span className="menu-option__label">{option.label}</span>
                        )}
                    </Link>
                )}
                {hasChildren && (
                    <div className="submenu" role="menu">
                        {option.children!.map((childOption) => (
                            <Link
                                key={childOption.label}
                                className="submenu-option"
                                href={childOption.to || '#'}
                                onClick={childOption.action}
                            >
                                {childOption.label}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        )
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
                    <img src={logoSrc} alt="Forkful logo" className="toolbar-logo" />
                    <div className="toolbar-title">
                        <span className="toolbar-name">Forkful</span>
                        <span className="toolbar-tagline">Recipes worth repeating</span>
                    </div>
                </Link>

                {/* Desktop menu */}
                <div className="menu menu--desktop">
                    <div className="menu__left">
                        {leftOptions.map(renderMenuOption)}
                    </div>
                    <div className="menu__right">
                        {rightOptions.map(renderMenuOption)}
                        <ThemeToggle />
                    </div>
                </div>

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
