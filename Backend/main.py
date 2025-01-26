from flask import Flask, send_from_directory, jsonify, Response, request
import os
from pathlib import Path
from MockDB import MockDB

app = Flask(__name__)
frontend_path = Path(os.path.dirname(os.path.dirname(__file__))) / 'plotD3'
mock_db = MockDB()


@app.route('/api/get-file-list')
def get_file_list():
    return jsonify(mock_db.get_files())


@app.route('/api/get-file/<filename>')
def get_file(filename):
    try:
        data = mock_db.load_file(filename)
        x_bytes = data['x'].tobytes()
        return Response(x_bytes, mimetype='application/octet-stream')
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/get-file-meta/<filename>')
def get_file_meta(filename):
    try:
        data = mock_db.load_file(filename)
        meta = {k: data[k] for k in ['p', 'label']}
        return jsonify(meta)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/update-labels/<filename>', methods=['POST'])
def update_labels(filename):
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        labels = request.json.get('labels')
        if not labels:
            return jsonify({"error": "No labels provided"}), 400

        # Save updated labels for filename
        mock_db.set_file_yconfig(filename, labels)

        return jsonify({"status": "success"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/')
def serve_index():
    return send_from_directory(frontend_path, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(frontend_path, path)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
