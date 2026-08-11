import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PromptSelector from '@/components/PromptSelector';
import { SUFFIX } from '@/utils/promptGenerator';
import type { PromptItem, ScanSettings } from '@/types/v3';

const prompts: PromptItem[] = [
  { id: 'p1', text: '강남역 임플란트 추천해줘' + SUFFIX, displayText: '강남역 임플란트 추천해줘', category: '지역형' },
];

function setup() {
  const onStart = vi.fn<(s: PromptItem[], set: ScanSettings) => void>();
  const utils = render(<PromptSelector prompts={prompts} onStart={onStart} />);
  return { onStart, ...utils };
}

const findPencil = (c: HTMLElement) =>
  [...c.querySelectorAll('button')].find(b => b.querySelector('svg.lucide-pencil'))!;
const findSave = (c: HTMLElement) =>
  [...c.querySelectorAll('button')].find(b => b.textContent === '저장')!;

describe('PromptSelector — 프롬프트 편집', () => {
  it('수정한 텍스트가 화면 목록에 반영된다', () => {
    const { container } = setup();
    fireEvent.click(findPencil(container));
    fireEvent.change(container.querySelector('textarea')!, { target: { value: '서초구 교정 잘하는 곳' } });
    fireEvent.click(findSave(container));

    expect(screen.getByText('서초구 교정 잘하는 곳')).toBeTruthy();
    expect(screen.queryByText('강남역 임플란트 추천해줘')).toBeNull();
  });

  it('편집창에는 접미사가 아니라 표시용 문구가 뜬다', () => {
    const { container } = setup();
    fireEvent.click(findPencil(container));
    const ta = container.querySelector('textarea')! as HTMLTextAreaElement;
    expect(ta.value).toBe('강남역 임플란트 추천해줘');
    expect(ta.value).not.toContain(SUFFIX.trim());
  });

  it('수정 후 실제 질의문에도 접미사가 유지된다', () => {
    const { container, onStart } = setup();
    fireEvent.click(findPencil(container));
    fireEvent.change(container.querySelector('textarea')!, { target: { value: '서초구 교정 잘하는 곳' } });
    fireEvent.click(findSave(container));

    fireEvent.click(screen.getByText('서초구 교정 잘하는 곳'));
    fireEvent.click(screen.getByText('스캔 시작'));

    expect(onStart).toHaveBeenCalled();
    const [selected] = onStart.mock.calls[0];
    expect(selected[0].text).toBe('서초구 교정 잘하는 곳' + SUFFIX);
    expect(selected[0].displayText).toBe('서초구 교정 잘하는 곳');
  });

  it('직접 추가한 프롬프트에도 접미사가 붙는다', () => {
    const { container, onStart } = setup();
    fireEvent.change(container.querySelector('input[type=text]')!, { target: { value: '분당 라미네이트 어디가 좋아' } });
    fireEvent.keyDown(container.querySelector('input[type=text]')!, { key: 'Enter' });

    fireEvent.click(screen.getByText('스캔 시작'));
    const [selected] = onStart.mock.calls[0];
    const added = selected.find((p: PromptItem) => p.displayText === '분당 라미네이트 어디가 좋아');
    expect(added).toBeTruthy();
    expect(added!.text).toBe('분당 라미네이트 어디가 좋아' + SUFFIX);
  });
});
