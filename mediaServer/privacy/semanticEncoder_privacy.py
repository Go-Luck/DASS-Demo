# semanticEncoder_privacy.py

from raPreprocessor_privacy import SemantPreprocessor
from raEncoder_privacy import SemantEncoder
import numpy as np

class semanticEncoder():
    def __init__(self, input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname,
                 input_dir_encode, output_dir_encode_temp, output_dir_encode_main,
                 frame_dir_name: str = "frame"):
        self.prepro = SemantPreprocessor(input_dir_pre, output_dir_pre, fps, max_chunk_duration,
                                         semantic_fname, frame_dir_name=frame_dir_name)
        self.encoder = SemantEncoder(input_dir_encode, output_dir_encode_temp, output_dir_encode_main, fps)
        self.output_dir_pre = output_dir_pre

    def encoding_all(self, enable_pre=True, start_frame=0, end_frame=None, privacy=False):
        folder_names = None
        if enable_pre:
            folder_names, _ = self.prepro.preProcessing_all(start_frame=start_frame, end_frame=end_frame,
                                                            privacy=privacy)
        else:
            folder_names = np.load(self.output_dir_pre + '/foldername.npy', allow_pickle=True)

        if folder_names is not None and len(folder_names) > 0:
            self.encoder.encoding(list(folder_names))
        else:
            print("[!] No segments to encode. Please check your frame range and preprocessing results.")

    def encoding_realtime(self):
        pass
