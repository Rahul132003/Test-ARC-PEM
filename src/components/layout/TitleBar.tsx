import { HiOutlineSquare3Stack3D, HiOutlineMagnifyingGlass } from 'react-icons/hi2';

interface Props {
  onSearchOpen: () => void;
}

const isWindows = window.electronAPI.platform === 'win32';

function WindowControls() {
  return (
    <div className="no-drag flex items-stretch h-12 ml-2">
      {/* Minimize */}
      <button
        onClick={() => window.electronAPI.minimizeWindow?.()}
        title="Minimize"
        className="w-11 flex items-center justify-center transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={() => window.electronAPI.maximizeWindow?.()}
        title="Maximize"
        className="w-11 flex items-center justify-center transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>

      {/* Close */}
      <button
        onClick={() => window.electronAPI.closeWindow?.()}
        title="Close"
        className="w-11 flex items-center justify-center transition-colors hover:bg-red-500 hover:text-white"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
}

export default function TitleBar({ onSearchOpen }: Props) {

  return (
    <div
      className="drag-region h-12 border-b flex items-center shrink-0 print:hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
        paddingLeft: isWindows ? '12px' : '80px',
        paddingRight: isWindows ? '0' : '20px',
      }}
    >
      {/* App identity */}
      <div className="flex items-center gap-2.5 no-drag">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <HiOutlineSquare3Stack3D className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
          Arch PEM
        </span>
      </div>

      <div className="flex-1" />

      {/* Search trigger + dark mode toggle */}
      <div className="no-drag flex items-center gap-2">
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors hover:border-indigo-400"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <HiOutlineMagnifyingGlass className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="font-mono text-[10px] px-1 py-0.5 rounded"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
            {isWindows ? 'Ctrl+K' : '⌘K'}
          </kbd>
        </button>



        {!isWindows && (
          <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>v1.0.0</span>
        )}
      </div>

      {/* Windows custom window controls — flush to the right edge */}
      {isWindows && <WindowControls />}
    </div>
  );
}
