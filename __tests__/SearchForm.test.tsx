import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SearchForm from '@/components/SearchForm';

describe('SearchForm Component', () => {
  it('renders clinic name input and submit button', () => {
    render(<SearchForm onNext={vi.fn()} />);
    expect(screen.getByPlaceholderText(/강남우리치과의원/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /프롬프트 자동 생성/i })).toBeInTheDocument();
  });
});
