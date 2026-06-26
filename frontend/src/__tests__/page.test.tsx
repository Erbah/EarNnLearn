import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Page from '../app/page'

// Mock the Next.js router to avoid invariant errors during component rendering
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: () => null,
      replace: () => null,
    };
  },
  usePathname() {
    return '';
  },
}));

describe('Home Page', () => {
  it('renders without crashing', () => {
    // Basic smoke test to ensure the page renders
    render(<Page />)
    
    // Check if a main element or text exists (adjust based on actual content)
    // Here we're just making sure the render doesn't throw
    expect(document.body).toBeInTheDocument()
  })
})
