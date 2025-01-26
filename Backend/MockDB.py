import json
from pathlib import Path

import numpy as np


class MockDB:
    def __init__(self):
        self.base = Path('C:\DatenSenvis\RelabelingTasks\Herbstrose-exits-only')
        self.files = {f.parent.stem: f for f in self.base.glob('*/x.npy')}

    def get_files(self):
        return list(self.files.keys())

    def load_file(self, file_name):
        x = np.load(self.files[file_name])
        p = [np.load(self.files[file_name].with_name('p0.npy')).tolist()]
        # integral = x - np.mean(x)
        # integral_abs = np.abs(integral)
        # low_change = np.quantile(integral_abs, 0.5)
        # integral[integral_abs < low_change] = 0
        # intergral = np.cumsum(integral)
        # noise = np.lib.stride_tricks.sliding_window_view(x, 8192)[::512]
        # noise = np.std(noise, axis=1)
        # label = np.zeros_like(x)
        # label[x.size // 2:] = 1

        label = self.get_ycconfig(file_name, len(x))
        # t = np.arange(x.size) / 1395
        # t_p = np.ascontiguousarray(t[8191::512])

        return {
            'x': x,
            'p': p,
            # 'integral': intergral,
            'label': label,
            # 'noise': noise,
            # 't': t,
            # 't_p': t_p
        }

    def get_yconfig_filename(self, file_name):
        return self.files[file_name].with_name('yconfig.json')

    def get_ycconfig(self, file_name, file_len):
        try:
            with open(self.get_yconfig_filename(file_name), 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return [{'ubs': [file_len], 'labels': [-1]}]

    def set_file_yconfig(self, file_name, yconfig):
        print("Setting yconfig for", file_name, "to", yconfig)
        with open(self.get_yconfig_filename(file_name), 'w') as f:
            json.dump(yconfig, f)
        return True
