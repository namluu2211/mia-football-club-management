import { silenceConsoleInProduction } from '../console-silencer';

describe('silenceConsoleInProduction', () => {
  const make = () => ({ log: jest.fn(), debug: jest.fn(), info: jest.fn() });

  it('replaces log/debug/info with no-ops in production', () => {
    const original = make();
    const target = { ...original };
    silenceConsoleInProduction(true, target);
    target.log('x'); target.debug('x'); target.info('x');
    expect(original.log).not.toHaveBeenCalled();
    expect(original.debug).not.toHaveBeenCalled();
    expect(original.info).not.toHaveBeenCalled();
  });

  it('leaves console untouched outside production', () => {
    const original = make();
    const target = { ...original };
    silenceConsoleInProduction(false, target);
    target.log('x');
    expect(original.log).toHaveBeenCalledWith('x');
  });
});