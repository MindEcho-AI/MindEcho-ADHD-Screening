import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

// Main application layout that wraps all authenticated pages
// with the sidebar navigation and routed page content.
export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-cream-100">
      <Sidebar />
      {/* Main routed page content displayed next to the sidebar */}
      <main className="flex-1 ml-[260px] transition-all duration-300 min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
