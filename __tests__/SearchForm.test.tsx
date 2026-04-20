import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SearchForm from '@/components/SearchForm';

describe('SearchForm Component', () => {
  it('renders three input fields and a submit button', () => {
    render(<SearchForm onSubmit={vi.fn()} />);
    
    // Check if Inputs exist by parsing their placeholders or roles
    expect(screen.getByPlaceholderText(/치과명 입력/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/지역명 입력/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/진료명 입력/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /검색 시작/i })).toBeInTheDocument();
  });

  it('calls onSubmit with correct data when submitted', () => {
    const mockSubmit = vi.fn();
    render(<SearchForm onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/치과명 입력/i), { target: { value: '우리치과' } });
    fireEvent.change(screen.getByPlaceholderText(/지역명 입력/i), { target: { value: '강남역' } });
    fireEvent.change(screen.getByPlaceholderText(/진료명 입력/i), { target: { value: '임플란트' } });

    fireEvent.click(screen.getByRole('button', { name: /검색 시작/i }));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledWith({
      clinicName: '우리치과',
      region: '강남역',
      treatment: '임플란트'
    });
  });
});
