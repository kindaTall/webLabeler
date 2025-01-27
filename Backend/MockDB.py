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
        p = [np.load(self.files[file_name].with_name('p0.npy')).tolist(),
             np.load(self.files[file_name].with_name('p1.npy')).tolist()]

        label = self.get_ycconfig(file_name, len(x))

        return {
            'x': x,
            'p': p,
            'label': label,
        }

    def get_yconfig_filename(self, file_name):
        return self.files[file_name].with_name('yconfig.json')

    def get_ycconfig(self, file_name, file_len):
        try:
            with open(self.get_yconfig_filename(file_name), 'r') as f:
                return self.validate_yconfigs(json.load(f))
        except FileNotFoundError:
            return self.validate_yconfigs([{'ubs': [file_len], 'labels': [-1]}])

    def set_file_yconfig(self, file_name, yconfig):
        print("Setting yconfig for", file_name, "to", yconfig)
        with open(self.get_yconfig_filename(file_name), 'w') as f:
            json.dump(yconfig, f)
        return True

    @staticmethod
    def validate_yconfigs(yconfigs):
        if len(yconfigs) == 1:
            yconfigs.append({'ubs': [yconfigs[0]['ubs'][-1]], 'labels': [-1]})

        for yconfig in yconfigs:
            for i, label in enumerate(yconfig['labels']):
                if label is None:
                    yconfig['labels'][i] = -1
        return yconfigs