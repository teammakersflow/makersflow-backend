import { renderWelcomeEmail } from './welcome';

describe('renderWelcomeEmail', () => {
  it('greets by first name and links to explore', () => {
    const r = renderWelcomeEmail({ name: 'Anu Shree', email: 'a@b.com', appUrl: 'https://makersflow.in/' });
    expect(r.subject).toContain('Welcome to MakersFlow');
    expect(r.html).toContain('Hi Anu,');
    expect(r.html).toContain('https://makersflow.in/explore');
    expect(r.text).toContain('Start learning: https://makersflow.in/explore');
  });

  it('falls back to "there" when name is missing', () => {
    const r = renderWelcomeEmail({ name: null, email: 'a@b.com', appUrl: 'https://makersflow.in' });
    expect(r.html).toContain('Hi there,');
  });

  it('escapes HTML in name and email', () => {
    const r = renderWelcomeEmail({ name: '<b>Anu</b>', email: '<x>@b.com', appUrl: 'https://makersflow.in' });
    expect(r.html).not.toContain('<b>Anu</b>');
    expect(r.html).toContain('&lt;b&gt;Anu&lt;/b&gt;');
    expect(r.html).toContain('&lt;x&gt;@b.com');
  });
});
