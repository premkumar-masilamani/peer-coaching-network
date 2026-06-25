import os
import glob

# Find all tsx files
files = glob.glob('src/**/*.tsx', recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    new_content = content.replace('glass-panel', 'structural-panel')
    # Change any "Submit" to "Save Changes" inside buttons
    # Actually, let's just do the structural-panel replacement.
    
    if new_content != content:
        with open(file, 'w') as f:
            f.write(new_content)
        print(f"Updated {file}")

