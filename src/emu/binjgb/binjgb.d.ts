/** Emscripten module factory for the vendored binjgb build (see UPSTREAM.md). */
export interface BinjgbModule {
  HEAP8: Int8Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _emulator_new_simple(
    romPtr: number,
    romSize: number,
    sampleRate: number,
    audioFrames: number,
    cgbColorCurve: number,
  ): number;
  _emulator_delete(e: number): void;
  _emulator_run_until_f64(e: number, ticks: number): number;
  _emulator_get_ticks_f64(e: number): number;
  _emulator_was_ext_ram_updated(e: number): boolean;
  _ext_ram_file_data_new(e: number): number;
  _file_data_delete(fileDataPtr: number): void;
  _get_file_data_ptr(fileDataPtr: number): number;
  _get_file_data_size(fileDataPtr: number): number;
  _emulator_read_ext_ram(e: number, fileDataPtr: number): void;
  _emulator_write_ext_ram(e: number, fileDataPtr: number): void;
  _get_frame_buffer_ptr(e: number): number;
  _get_frame_buffer_size(e: number): number;
  _get_audio_buffer_ptr(e: number): number;
  _get_audio_buffer_capacity(e: number): number;
  _set_joyp_up(e: number, set: boolean): void;
  _set_joyp_down(e: number, set: boolean): void;
  _set_joyp_left(e: number, set: boolean): void;
  _set_joyp_right(e: number, set: boolean): void;
  _set_joyp_select(e: number, set: boolean): void;
  _set_joyp_start(e: number, set: boolean): void;
  _set_joyp_B(e: number, set: boolean): void;
  _set_joyp_A(e: number, set: boolean): void;
}

/** Options accepted by the Emscripten factory; we only use these. */
export interface BinjgbInit {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (path: string, scriptDirectory: string) => string;
}

declare function Binjgb(init?: BinjgbInit): Promise<BinjgbModule>;
export default Binjgb;
