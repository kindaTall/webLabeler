import numpy as np
from flask import Flask, send_from_directory, jsonify, Response, request
import os
from pathlib import Path
from db_interface import MockDB, DBInterface
import json

from waitress import serve
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
frontend_path = Path(os.path.dirname(os.path.dirname(__file__))) / 'html'


@app.route('/api/get-file-list')
def get_file_list():
    return jsonify(app.db.get_files())


@app.route('/api/get-file', methods=['POST'])
def get_file():
    payload = request.get_json()
    filename = payload['filename']

    try:
        data = app.db.load_file(filename)
        x_bytes = data.x.astype(np.int32).tobytes()
        return Response(x_bytes, mimetype='application/octet-stream')
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/get-file-meta', methods=['POST'])
def get_file_meta():
    payload = request.get_json()
    filename = payload['filename']

    try:
        data = app.db.load_file(filename)
        meta = {'p': data.p, 'label': data.label}
        return jsonify(meta)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/update-labels', methods=['POST'])
def update_labels():
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        filename = request.json.get('filename')

        labels = request.json.get('labels')
        if not labels:
            return jsonify({"error": "No labels provided"}), 400

        # Save updated labels for filename
        app.db.set_file_yconfig(filename, labels)

        return jsonify({"status": "success"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/filter-presets', methods=['GET'])
def get_filter_presets():
    try:
        presets_path = Path(app.db.root_dir) / 'filter_presets.json'
        if not presets_path.exists():
            return jsonify([])
        with open(presets_path, 'r') as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/filter-presets', methods=['POST'])
def save_filter_presets():
    try:
        presets = request.json.get('presets')
        if not presets:
            return jsonify({"error": "No presets provided"}), 400

        presets_path = Path(app.db.root_dir) / 'filter_presets.json'
        with open(presets_path, 'w') as f:
            json.dump(presets, f, indent=2)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/')
def serve_index():
    return send_from_directory(frontend_path, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(frontend_path, path)


@app.after_request
def log_request(response):
    logger.info(f'{request.method} {request.path} - Status: {response.status_code}')
    if response.status_code >= 400:
        logger.error(f'{request.method} {request.path} - Error response: {response.get_data(as_text=True)}')
    return response


def run_weblabeler(db: DBInterface):
    app.db = db
    port = 8080
    print(f"Running weblabeler on port {port}")
    serve(app, host='0.0.0.0', port=port)


if __name__ == '__main__':
    run_weblabeler(MockDB())
