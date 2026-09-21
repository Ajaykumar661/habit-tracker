import { describe, it, expect, vi, beforeEach } from 'vitest';

// The native half of exportBackup can't run under Node, so Capacitor is
// mocked: what matters is that the file is written and handed to the share
// sheet, and that a dismissed sheet is never reported as a saved backup.
const native = { on: true };
const writeFile = vi.fn(async () => ({ uri: 'file:///cache/tally-wall.json' }));
const share = vi.fn(async () => ({}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...a) => writeFile(...a) },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: (...a) => share(...a) } }));
vi.mock('./storage', () => ({
  loadState: () => ({
    habits: [{ id: 'read', name: 'READ' }],
    completions: { read: { '2026-09-20': { date: '2026-09-20', completed: true } } },
    notes: {},
    settings: {},
  }),
  saveState: vi.fn(),
}));

const { exportBackup, backupFilename } = await import('./backup');

beforeEach(() => {
  native.on = true;
  writeFile.mockClear();
  share.mockReset();
  share.mockImplementation(async () => ({}));
});

describe('exporting inside the Android / iOS app', () => {
  it('writes the backup to a real file', async () => {
    await exportBackup();
    expect(writeFile).toHaveBeenCalledTimes(1);
    const arg = writeFile.mock.calls[0][0];
    expect(arg.path).toBe(backupFilename());
    expect(arg.directory).toBe('CACHE');
    expect(JSON.parse(arg.data).completions).toHaveLength(1);
  });

  it('hands that file to the system share sheet', async () => {
    await exportBackup();
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files).toEqual(['file:///cache/tally-wall.json']);
  });

  it('reports what was saved', async () => {
    const r = await exportBackup();
    expect(r).toEqual({ routines: 1, tallies: 1, cancelled: false });
  });

  it('never calls a dismissed share sheet a saved backup', async () => {
    share.mockImplementation(async () => { throw new Error('Share canceled'); });
    const r = await exportBackup();
    expect(r.cancelled).toBe(true);
  });

  it('still surfaces a real failure', async () => {
    share.mockImplementation(async () => { throw new Error('No app can handle this'); });
    await expect(exportBackup()).rejects.toThrow('No app can handle this');
  });
});
