import engine from '.';

describe('kites init', () => {
  it('should init a new kites instance without options!', async () => {
    const app = await engine().init();
    app.logger.info('A new kites started!');
  });
});
