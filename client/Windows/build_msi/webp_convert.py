import sys
from PIL import Image
import io

def convert_webp_to_png(input_data):
    try:
        img = Image.open(io.BytesIO(input_data))
        output_buffer = io.BytesIO()
        img.save(output_buffer, format='PNG')
        return output_buffer.getvalue()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        with open(input_file, 'rb') as f:
            input_data = f.read()
        result = convert_webp_to_png(input_data)
        if result:
            with open(output_file, 'wb') as f:
                f.write(result)
            print(f"Converted {len(input_data)} bytes to PNG")
        else:
            sys.exit(1)
    else:
        input_data = sys.stdin.buffer.read()
        result = convert_webp_to_png(input_data)
        if result:
            sys.stdout.buffer.write(result)
        else:
            sys.exit(1)