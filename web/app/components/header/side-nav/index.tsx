'use client'

import {
  RiApps2Line,
  RiDashboardFill,
  RiDashboardLine,
  RiDatabase2Fill,
  RiDatabase2Line,
  RiExchange2Line,
  RiFile4Line,
  RiFileShield2Line,
  RiFolderShield2Line,
  RiHammerFill,
  RiHammerLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiMessage3Line,
  RiPlanetFill,
  RiPlanetLine,
  RiRobot3Line,
  RiSettings4Line,
  RiShieldCheckFill,
  RiShieldCheckLine,
} from '@remixicon/react'
import Link from 'next/link'
import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation'
import { useState } from 'react'
import { useAppContext } from '@/context/app-context'
import { Group } from '@/app/components/base/icons/src/vender/other'
import { cn } from '@/utils/classnames'
import AccountDropdown from '../account-dropdown'
import EnvNav from '../env-nav'
import PluginsNav from '../plugins-nav'

interface SubItemConfig {
  id: string
  href: string
  icon: React.ReactNode
  label: string
}

interface NavItemConfig {
  id: string
  href: string
  icon: React.ReactNode
  activeIcon: React.ReactNode
  label: string
  segments: string[]
  children?: SubItemConfig[]
  /** query param name used for child active detection */
  childParam?: string
  /** default child id when no param is set */
  childDefault?: string
}

const SideNav = () => {
  const segment = useSelectedLayoutSegment()
  const searchParams = useSearchParams()
  const { isCurrentWorkspaceEditor, isCurrentWorkspaceDatasetOperator } = useAppContext()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined')
      return localStorage.getItem('side_nav_collapsed') === 'true'
    return false
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('side_nav_collapsed', String(next))
      return next
    })
  }


  // 工作台子菜单
  const appsChildren: SubItemConfig[] = [
    { id: 'all', href: '/apps?category=all', icon: <RiApps2Line className="h-4 w-4" />, label: '全部' },
    { id: 'workflow', href: '/apps?category=workflow', icon: <RiExchange2Line className="h-4 w-4" />, label: '工作流' },
    { id: 'advanced-chat', href: '/apps?category=advanced-chat', icon: <RiMessage3Line className="h-4 w-4" />, label: 'Chatflow' },
    { id: 'chat', href: '/apps?category=chat', icon: <RiMessage3Line className="h-4 w-4" />, label: '聊天助手' },
    { id: 'agent-chat', href: '/apps?category=agent-chat', icon: <RiRobot3Line className="h-4 w-4" />, label: 'Agent' },
    { id: 'completion', href: '/apps?category=completion', icon: <RiFile4Line className="h-4 w-4" />, label: '文本生成' },
  ]

  const navItems: NavItemConfig[] = []

  // 工作台 (原 apps)
  if (!isCurrentWorkspaceDatasetOperator) {
    navItems.push({
      id: 'apps',
      href: '/apps',
      icon: <RiDashboardLine className="h-5 w-5" />,
      activeIcon: <RiDashboardFill className="h-5 w-5" />,
      label: '工作台',
      segments: ['apps', 'app'],
      children: appsChildren,
      childParam: 'category',
      childDefault: 'all',
    })
  }

  // 脱敏沙箱子菜单
  const dataMaskingChildren: SubItemConfig[] = [
    { id: 'mask', href: '/data-masking?tab=mask', icon: <RiFileShield2Line className="h-4 w-4" />, label: '文件脱敏' },
    { id: 'rules', href: '/data-masking?tab=rules', icon: <RiShieldCheckLine className="h-4 w-4" />, label: '脱敏规则' },
    { id: 'files', href: '/data-masking?tab=files', icon: <RiFolderShield2Line className="h-4 w-4" />, label: '文件管理' },
    { id: 'sandbox', href: '/data-masking?tab=sandbox', icon: <RiSettings4Line className="h-4 w-4" />, label: '沙箱配置' },
  ]

  // 脱敏沙箱
  if (!isCurrentWorkspaceDatasetOperator) {
    navItems.push({
      id: 'data-masking',
      href: '/data-masking',
      icon: <RiShieldCheckLine className="h-5 w-5" />,
      activeIcon: <RiShieldCheckFill className="h-5 w-5" />,
      label: '脱敏沙箱',
      segments: ['data-masking'],
      children: dataMaskingChildren,
      childParam: 'tab',
      childDefault: 'mask',
    })
  }

  // 探索
  if (!isCurrentWorkspaceDatasetOperator) {
    navItems.push({
      id: 'explore',
      href: '/explore/apps',
      icon: <RiPlanetLine className="h-5 w-5" />,
      activeIcon: <RiPlanetFill className="h-5 w-5" />,
      label: '探索',
      segments: ['explore'],
    })
  }

  // 知识库
  if (isCurrentWorkspaceEditor || isCurrentWorkspaceDatasetOperator) {
    navItems.push({
      id: 'datasets',
      href: '/datasets',
      icon: <RiDatabase2Line className="h-5 w-5" />,
      activeIcon: <RiDatabase2Fill className="h-5 w-5" />,
      label: '知识库',
      segments: ['datasets'],
    })
  }

  // 工具
  if (!isCurrentWorkspaceDatasetOperator) {
    navItems.push({
      id: 'tools',
      href: '/tools',
      icon: <RiHammerLine className="h-5 w-5" />,
      activeIcon: <RiHammerFill className="h-5 w-5" />,
      label: '工具',
      segments: ['tools'],
    })
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col shrink-0 bg-[#1a1f2e] transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* Logo + tagline + collapse */}
      <div className={cn(
        'flex items-center shrink-0',
        collapsed ? 'flex-col gap-1 px-2 py-4' : 'justify-between px-4 py-4',
      )}>
        <Link href="/apps" className="flex items-center gap-3 shrink-0">
          <div className={cn(
            'rounded-xl border border-white/20 overflow-hidden shrink-0',
            collapsed ? 'w-8 h-8' : 'w-10 h-10',
          )}>
            <img
              src="/logo/CheersAI.png"
              alt="CheersAI"
              className="w-full h-full object-cover scale-125"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-white/90 text-xs font-medium">省心用</span>
              <span className="text-white/90 text-xs font-medium">安心用</span>
              <span className="text-white/90 text-xs font-medium">领先用</span>
            </div>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5"
          title={collapsed ? '展开导航' : '收起导航'}
        >
          {collapsed
            ? <RiMenuUnfoldLine className="w-4 h-4" />
            : <RiMenuFoldLine className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.segments.includes(segment ?? '')
          const hasChildren = item.children && item.children.length > 0
          const showChildren = isActive && hasChildren && !collapsed

          return (
            <div key={item.id}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl transition-colors',
                  collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3',
                  isActive && !showChildren
                    ? 'bg-[#2563eb] text-white font-medium'
                    : isActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                <span className="shrink-0">
                  {isActive ? item.activeIcon : item.icon}
                </span>
                {!collapsed && (
                  <span className="text-sm truncate">
                    {item.label}
                  </span>
                )}
              </Link>
              {/* Sub-items */}
              {showChildren && (
                <div className="mt-0.5 ml-4 flex flex-col gap-0.5">
                  {item.children!.map((child) => {
                    const paramValue = item.childParam ? (searchParams.get(item.childParam) || item.childDefault) : ''
                    const isChildActive = isActive && paramValue === child.id
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors text-[13px]',
                          isChildActive
                            ? 'bg-[#2563eb] text-white font-medium'
                            : 'text-white/60 hover:bg-white/5 hover:text-white/90',
                        )}
                      >
                        <span className="shrink-0">{child.icon}</span>
                        <span className="truncate">{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: env, plugins, account */}
      <div className="shrink-0 border-t border-white/5 px-3 py-3 flex flex-col gap-2">
        {!collapsed
          ? (
            <>
              <EnvNav />
              <div className="side-nav-plugins-wrap">
                <PluginsNav />
              </div>
              <AccountDropdown />
            </>
          )
          : (
            <>
              <Link href="/plugins" title="插件" className="flex justify-center py-1.5 rounded-lg hover:bg-white/10 w-full">
                <Group className="h-5 w-5 text-white/60 hover:text-white" />
              </Link>
              <div className="flex justify-center w-full">
                <AccountDropdown />
              </div>
            </>
          )}
      </div>
      <style jsx global>{`
        .side-nav-plugins-wrap .plugins-nav-button > div {
          color: rgba(255,255,255,0.7) !important;
          border-color: transparent !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .side-nav-plugins-wrap .plugins-nav-button > div:hover {
          color: white !important;
          background: rgba(255,255,255,0.05) !important;
        }
        .side-nav-plugins-wrap .plugins-nav-button > div svg,
        .side-nav-plugins-wrap .plugins-nav-button > div span {
          color: inherit !important;
        }
      `}</style>
    </div>
  )
}

export default SideNav
