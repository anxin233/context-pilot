# Context Pilot

Context Pilot helps you save, restore, compare, import, and export your editor context in VS Code. It captures open editors, cursor positions, selections, editor groups, pinned tabs, and terminal metadata so you can quickly return to a previous working state.

`中文` | `English`

## 中文说明

### 功能简介

Context Pilot 用来保存、恢复和切换你的 VS Code 工作上下文。它会记录：

- 已打开的编辑器标签
- 光标位置和多选区
- 编辑器分栏布局
- 固定标签状态
- 终端名称与工作目录
- Git 分支关联快照

### 主要功能

- 保存当前上下文为快照
- 一键恢复之前的工作状态
- 在侧边栏查看和管理快照
- 支持导入、导出、对比快照
- 支持最近快照快速切换
- 可选 Git 分支自动保存/恢复

### 快速开始

1. 打开一个工作区或文件夹。
2. 执行命令 `Context Pilot: Save Snapshot` 保存当前上下文。
3. 执行命令 `Context Pilot: Restore Snapshot` 恢复历史快照。
4. 在 Activity Bar 中打开 `Context Pilot` 侧边栏管理所有快照。

### 命令

- `Context Pilot: Save Snapshot`
- `Context Pilot: Restore Snapshot`
- `Context Pilot: Delete Snapshot`
- `Context Pilot: Rename Snapshot`
- `Context Pilot: Toggle Auto Branch Switch`
- `Context Pilot: Export Snapshot`
- `Context Pilot: Import Snapshot`
- `Context Pilot: Compare Snapshots`

### 默认快捷键

- `Ctrl+Alt+S`: 保存快照
- `Ctrl+Alt+L`: 恢复快照
- `Ctrl+Alt+1` ... `Ctrl+Alt+9`: 快速切换最近快照槽位

### 配置项

- `contextPilot.confirmBeforeRestore`: 恢复前是否弹出确认
- `contextPilot.maxSnapshots`: 最大快照数量
- `contextPilot.showStatusBar`: 是否显示状态栏入口
- `contextPilot.autoSwitchOnBranch`: 是否在 Git 分支切换时自动保存/恢复
- `contextPilot.quickSwitchSlots`: 启用的快速切换槽位数量

### 已知说明

- 新版本对多根工作区的快照恢复支持更完整；旧版本保存的多根工作区快照会走兼容回退逻辑。
- 终端会按名称和工作目录去重恢复，但不会恢复终端中的命令历史。
- 仅文本编辑器标签会被完整记录和恢复。

## English

### Overview

Context Pilot lets you save and restore your VS Code working context. It captures:

- Open editor tabs
- Cursor positions and selections
- Editor group layout
- Pinned tab state
- Terminal names and working directories
- Git branch-linked snapshots

### Features

- Save the current workspace context as a snapshot
- Restore a previous working state in one step
- Manage snapshots from a dedicated sidebar view
- Import, export, and compare snapshots
- Quickly switch between recent snapshots
- Optional automatic save/restore on Git branch switches

### Quick Start

1. Open a folder or workspace in VS Code.
2. Run `Context Pilot: Save Snapshot` to save your current context.
3. Run `Context Pilot: Restore Snapshot` to restore a saved snapshot.
4. Open the `Context Pilot` view in the Activity Bar to manage snapshots.

### Commands

- `Context Pilot: Save Snapshot`
- `Context Pilot: Restore Snapshot`
- `Context Pilot: Delete Snapshot`
- `Context Pilot: Rename Snapshot`
- `Context Pilot: Toggle Auto Branch Switch`
- `Context Pilot: Export Snapshot`
- `Context Pilot: Import Snapshot`
- `Context Pilot: Compare Snapshots`

### Default Keybindings

- `Ctrl+Alt+S`: Save snapshot
- `Ctrl+Alt+L`: Restore snapshot
- `Ctrl+Alt+1` ... `Ctrl+Alt+9`: Quick-switch recent snapshot slots

### Settings

- `contextPilot.confirmBeforeRestore`: Confirm before restoring a snapshot
- `contextPilot.maxSnapshots`: Maximum number of snapshots to keep
- `contextPilot.showStatusBar`: Show or hide the status bar entry
- `contextPilot.autoSwitchOnBranch`: Automatically save/restore when switching Git branches
- `contextPilot.quickSwitchSlots`: Number of enabled quick-switch slots

### Notes

- Newer snapshots restore multi-root workspaces more accurately. Older multi-root snapshots are restored with compatibility fallbacks.
- Terminals are restored by name and working directory, but shell history is not recreated.
- Only text editor tabs are fully captured and restored.

## License

MIT
