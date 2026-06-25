import re

with open('src/index.css', 'r') as f:
    css = f.read()

# Update fonts
css = re.sub(
    r"@import url\('https://fonts.googleapis.com/css2\?family=Lora[^']+'\);",
    "@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800&display=swap');",
    css
)

css = css.replace("--font-family-display: 'Lora', Georgia, serif;", "--font-family-display: 'Instrument Serif', Georgia, serif;")
css = css.replace("--font-family-body: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;", "--font-family-body: 'Outfit', system-ui, -apple-system, sans-serif;")

# Dark Theme
css = re.sub(r'--bg-base: 215 28% 8%;', '--bg-base: 0 0% 4%;', css)
css = re.sub(r'--bg-surface: 215 28% 12%;', '--bg-surface: 0 0% 8%;', css)
css = re.sub(r'--bg-surface-elevated: 215 28% 16%;', '--bg-surface-elevated: 0 0% 12%;', css)

css = re.sub(r'--primary: 173 80% 40%;', '--primary: 260 100% 47%;', css)
css = re.sub(r'--primary-hover: 173 80% 48%;', '--primary-hover: 260 100% 55%;', css)
css = re.sub(r'--primary-glow: rgba\(13, 148, 136, 0.15\);', '--primary-glow: rgba(79, 0, 242, 0.15);', css)

css = re.sub(r'--accent: 38 86% 56%;', '--accent: 70 100% 50%;', css)
css = re.sub(r'--accent-hover: 38 86% 64%;', '--accent-hover: 70 100% 40%;', css)

css = re.sub(r'--text-primary: 210 20% 98%;', '--text-primary: 0 0% 98%;', css)
css = re.sub(r'--text-secondary: 215 16% 75%;', '--text-secondary: 0 0% 75%;', css)
css = re.sub(r'--text-muted: 215 12% 50%;', '--text-muted: 0 0% 50%;', css)

css = re.sub(r'--border-light: rgba\(255, 255, 255, 0.08\);', '--border-light: rgba(255, 255, 255, 0.12);', css)
css = re.sub(r'--border-focus: rgba\(13, 148, 136, 0.4\);', '--border-focus: rgba(79, 0, 242, 0.4);', css)

# Glassmorphism -> Structural
css = re.sub(r'--glass-bg: .*?;', '--structural-bg: hsl(var(--bg-surface));', css)
css = re.sub(r'--glass-border: .*?;', '--structural-border: var(--border-light);', css)
css = re.sub(r'--glass-shadow: 0 8px 32px 0 rgba\(0, 0, 0, 0.37\);', '--structural-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.5);', css)
css = re.sub(r'--glass-blur: blur\(12px\);\n', '', css)

# Light Theme
css = re.sub(r'--bg-base: 30 20% 97%;', '--bg-base: 0 0% 100%;', css)
css = re.sub(r'--bg-surface: 0 0% 100%;', '--bg-surface: 150 14% 96%;', css)
css = re.sub(r'--bg-surface-elevated: 30 15% 95%;', '--bg-surface-elevated: 150 14% 92%;', css)

css = re.sub(r'--primary: 173 84% 30%;', '--primary: 260 100% 47%;', css)
css = re.sub(r'--primary-hover: 173 84% 24%;', '--primary-hover: 260 100% 40%;', css)
css = re.sub(r'--primary-glow: rgba\(15, 118, 110, 0.12\);', '--primary-glow: rgba(79, 0, 242, 0.12);', css)

css = re.sub(r'--accent: 35 84% 36%;', '--accent: 260 100% 47%;', css)
css = re.sub(r'--accent-hover: 35 84% 30%;', '--accent-hover: 260 100% 40%;', css)

css = re.sub(r'--text-primary: 215 28% 12%;', '--text-primary: 0 0% 8%;', css)
css = re.sub(r'--text-secondary: 215 16% 35%;', '--text-secondary: 0 0% 35%;', css)
css = re.sub(r'--text-muted: 215 12% 55%;', '--text-muted: 0 0% 55%;', css)

css = re.sub(r'--border-light: rgba\(15, 23, 42, 0.08\);', '--border-light: rgba(0, 0, 0, 0.12);', css)
css = re.sub(r'--border-focus: rgba\(15, 118, 110, 0.4\);', '--border-focus: rgba(79, 0, 242, 0.4);', css)

css = re.sub(r'--glass-shadow: 0 8px 32px 0 rgba\(15, 23, 42, 0.04\);', '--structural-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.08);', css)

# Modal overlay
css = re.sub(r'--modal-overlay-bg: rgba\(14, 19, 27, 0.8\);', '--modal-overlay-bg: rgba(10, 10, 10, 0.95);', css)
css = re.sub(r'--modal-overlay-bg: rgba\(247, 246, 243, 0.8\);', '--modal-overlay-bg: rgba(245, 247, 246, 0.95);', css)
css = re.sub(r'backdrop-filter: blur\(8px\);\n', '', css)

# Glass panel -> Structural panel
css = css.replace("/* Glassmorphism Containers */", "/* Structural Containers */")
css = css.replace(".glass-panel", ".structural-panel")
css = css.replace(".glass-panel-interactive", ".structural-panel-interactive")

css = css.replace("background: var(--glass-bg);", "background: var(--structural-bg);")
css = css.replace("border: 1px solid var(--glass-border);", "border: 1px solid var(--structural-border);")
css = css.replace("box-shadow: var(--glass-shadow);", "box-shadow: var(--structural-shadow);")
css = css.replace("backdrop-filter: var(--glass-blur);\n", "")
css = css.replace("-webkit-backdrop-filter: var(--glass-blur);\n", "")
css = css.replace("border-radius: 16px;", "border-radius: 2px;")

css = css.replace("border-color: rgba(13, 148, 136, 0.2);", "border-color: rgba(79, 0, 242, 0.4);")
css = css.replace("box-shadow: 0 12px 40px 0 rgba(13, 148, 136, 0.08), var(--glass-shadow);", "box-shadow: 0 8px 30px 0 rgba(79, 0, 242, 0.12), var(--structural-shadow);")

# Buttons and inputs
css = css.replace("border-radius: 10px;", "border-radius: 2px;")
css = css.replace("border-radius: 12px;", "border-radius: 2px;")
css = css.replace("border-radius: 8px;", "border-radius: 2px;")

# Sidebar layout
css = css.replace("border-radius: 16px;\n  margin-right: 24px;", "border-radius: 0;\n  margin-right: 0;\n  border-right: 1px solid var(--border-light);")

with open('src/index.css', 'w') as f:
    f.write(css)

