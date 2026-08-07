import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, useRef } from 'react'
import { Sidebar } from '../src/components/Sidebar/Sidebar'

// 包装组件：模拟 App 的真实数据流——onCreateFolder 时乐观地把新节点加入 nodes
// 用 useRef 稳定 spy 引用，避免重渲染后引用变化导致断言失效
function renderSidebar(initialNodes: any[] = []) {
  const spies = { onCreateFolder: vi.fn(), onRenameNode: vi.fn() }
  function Host() {
    const [nodes, setNodes] = useState<any[]>(initialNodes)
    const handleCreateFolder = useRef(async (parentId?: string) => {
      const newId = 'new-1'
      setNodes(prev => [...prev, { id: newId, type: 'folder', title: '新建文件夹', parentId: parentId ?? null }])
      spies.onCreateFolder(parentId)
      return newId
    }).current
    return (
      <Sidebar
        nodes={nodes}
        currentDocId={null}
        onSelectDoc={vi.fn()}
        onCreateDoc={vi.fn()}
        onCreateFolder={handleCreateFolder}
        onDeleteDoc={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRenameNode={spies.onRenameNode}
      />
    )
  }
  const utils = render(<Host />)
  return { ...utils, spies }
}

describe('Sidebar 文件夹命名', () => {
  it('新建文件夹：点击后出现 input，输入名字回车后调用 onRenameNode', async () => {
    const { spies } = renderSidebar([])
    const user = userEvent.setup()

    const btn = screen.getByRole('button', { name: /新建文件夹/ })
    await user.click(btn)

    expect(spies.onCreateFolder).toHaveBeenCalled()
    const input = await screen.findByDisplayValue('新建文件夹')
    expect(input).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '工作笔记')
    expect((input as HTMLInputElement).value).toBe('工作笔记')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(spies.onRenameNode).toHaveBeenCalledWith('new-1', 'folder', '工作笔记')
    })
    console.log('✅ 新建文件夹 onRenameNode:', spies.onRenameNode.mock.calls)
  })

  it('改名：点击改名按钮后出现 input，输入新名字回车后调用 onRenameNode', async () => {
    const { container, spies } = renderSidebar([{ id: 'f1', type: 'folder', title: '旧名字', parentId: null }])
    const user = userEvent.setup()

    const renameBtn = container.querySelector('button[title^="重命名"]') as HTMLButtonElement
    expect(renameBtn).toBeTruthy()
    await user.click(renameBtn)

    const input = await screen.findByDisplayValue('旧名字')
    expect(input).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '新名字')
    expect((input as HTMLInputElement).value).toBe('新名字')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(spies.onRenameNode).toHaveBeenCalledWith('f1', 'folder', '新名字')
    })
    console.log('✅ 改名 onRenameNode:', spies.onRenameNode.mock.calls)
  })
})
