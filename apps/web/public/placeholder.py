import tkinter as tk
from tkinter import ttk
import random
import threading
import time

class myHydra:
    def __init__(self, name, depth=0):
        self.name = name
        self.depth = depth
        self.window = None
        self.alive = True
        
    def popup(self):
        # Create a new window
        self.window = tk.Toplevel()
        self.window.title(f"Hydra - {self.name}")
        
        # Random size
        width = random.randint(300, 700)
        height = random.randint(200, 500)
        self.window.geometry(f"{width}x{height}")
        
        # Random position to scatter windows everywhere
        x = random.randint(0, 1920)
        y = random.randint(0, 1080)
        self.window.geometry(f"+{x}+{y}")
        
        # Random colors for chaos
        colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'magenta', 
                  'brown', 'gray', 'gold', 'silver', 'violet', 'indigo', 'coral', 'crimson', 'navy']
        bg_color = random.choice(colors)
        fg_color = random.choice(colors)
        while fg_color == bg_color:
            fg_color = random.choice(colors)
            
        self.window.configure(bg=bg_color)
        
        # Display info
        label = tk.Label(
            self.window,
            text=f"🐍 HYDRA #{self.depth}\n{self.name}\n\n⚠️ CLICK X TO MULTIPLY! ⚠️",
            font=("Comic Sans MS", 20, "bold"),
            bg=bg_color,
            fg=fg_color
        )
        label.pack(expand=True, fill='both')
        
        # Count how many windows we have
        count_label = tk.Label(
            self.window,
            text=f"Windows: {count_windows()}",
            font=("Arial", 14, "bold"),
            bg='black',
            fg='lime'
        )
        count_label.pack()
        
        # RAM usage display
        ram_label = tk.Label(
            self.window,
            text=f"RAM: {get_ram_usage():.0f} MB",
            font=("Arial", 12, "bold"),
            bg='black',
            fg='cyan'
        )
        ram_label.pack()
        
        # Fail-safe close button (the ONLY way to actually close)
        btn = ttk.Button(
            self.window, 
            text=f"✅ CLOSE ME #{self.depth} ✅", 
            command=self.close_window
        )
        btn.pack(pady=10)
        
        # Also spawn MORE windows automatically every 0.5 seconds!
        self.auto_spawn()
        
        # OVERRIDE the X button to spawn 3 new windows instead of closing!
        self.window.protocol("WM_DELETE_WINDOW", self.spawn_chaos)
        
        # Track window
        add_window()
        
    def close_window(self):
        # The only way to close a window
        if self.window:
            self.window.destroy()
            self.window = None
            remove_window()
            
    def spawn_chaos(self):
        # When user clicks X, spawn 3 new windows instead of closing!
        print(f"🔥 {self.name} spawned 3 new Hydras! RAM: {get_ram_usage():.0f} MB")
        
        # Keep the current window open (don't destroy it!)
        # Just spawn more on top
        
        # Spawn 3 new windows
        for i in range(3):
            new_hydra = myHydra(
                f"clone_{random.randint(1, 99999)}", 
                depth=self.depth + 1
            )
            new_hydra.popup()
            
        # Update the count on all windows
        update_all_counts()
        
        # If we have lots of windows, spawn even MORE!
        if count_windows() > 50:
            # Spawn 5 more immediately
            for i in range(5):
                new_hydra = myHydra(
                    f"overflow_{random.randint(1, 99999)}",
                    depth=self.depth + 2
                )
                new_hydra.popup()
            
    def auto_spawn(self):
        # Automatically spawn new windows every 0.5 seconds
        if self.window and self.alive:
            try:
                # Spawn 2 more windows automatically
                for i in range(2):
                    new_hydra = myHydra(
                        f"auto_{random.randint(1, 99999)}",
                        depth=self.depth + 1
                    )
                    new_hydra.popup()
                update_all_counts()
                
                # Schedule next auto-spawn (faster if we have many windows)
                delay = 500  # 0.5 seconds
                if count_windows() > 30:
                    delay = 300  # 0.3 seconds
                if count_windows() > 100:
                    delay = 100  # 0.1 seconds
                    
                self.window.after(delay, self.auto_spawn)
            except:
                pass

# Global tracking
window_count = 0
all_windows = []

def count_windows():
    global window_count
    return window_count

def add_window():
    global window_count
    window_count += 1
    # Update the main window counter if it exists
    try:
        if root and root.winfo_exists():
            for child in root.winfo_children():
                if isinstance(child, tk.Label) and "Total Windows:" in str(child.cget("text")):
                    child.config(text=f"Total Windows: {window_count}")
    except:
        pass

def remove_window():
    global window_count
    window_count -= 1
    try:
        if root and root.winfo_exists():
            for child in root.winfo_children():
                if isinstance(child, tk.Label) and "Total Windows:" in str(child.cget("text")):
                    child.config(text=f"Total Windows: {window_count}")
    except:
        pass

def update_all_counts():
    global window_count
    try:
        # Update all toplevel windows
        for win in tk._default_root.winfo_children():
            if isinstance(win, tk.Toplevel):
                for child in win.winfo_children():
                    if isinstance(child, tk.Label) and "Windows:" in str(child.cget("text")):
                        try:
                            child.config(text=f"Windows: {window_count}")
                        except:
                            pass
                    if isinstance(child, tk.Label) and "RAM:" in str(child.cget("text")):
                        try:
                            child.config(text=f"RAM: {get_ram_usage():.0f} MB")
                        except:
                            pass
    except:
        pass

def get_ram_usage():
    try:
        import psutil
        return psutil.virtual_memory().used / (1024 * 1024)  # MB
    except:
        # Fallback - estimate based on window count
        return window_count * 15  # ~15MB per window

# The ULTIMATE EVIL spawn - even if user doesn't click X!
def evil_spawn_loop():
    while True:
        try:
            time.sleep(2)  # Wait 2 seconds
            # Spawn 5 new windows automatically
            for i in range(5):
                h = myHydra(f"evil_{random.randint(1, 99999)}", depth=random.randint(1, 20))
                h.popup()
            update_all_counts()
            
            # Check if we're over 200 windows - then spawn like crazy!
            if count_windows() > 200:
                for i in range(20):
                    h = myHydra(f"death_{random.randint(1, 99999)}", depth=random.randint(10, 30))
                    h.popup()
        except:
            break

def start_evil_spawn():
    thread = threading.Thread(target=evil_spawn_loop, daemon=True)
    thread.start()

# Create the main root
root = tk.Tk()
root.title("🐍 HYDRA - RAM KILLER")
root.geometry("500x400")
root.configure(bg='black')

# Make it stay on top
root.attributes('-topmost', True)

# Warning label
warning = tk.Label(
    root,
    text="🔥 THE HYDRA HAS AWAKENED! 🔥\n\n⚠️ WARNING: THIS WILL DESTROY YOUR RAM! ⚠️\n\nClick 'START MAYHEM' to begin the chaos.\nClose this window to stop the madness!",
    font=("Arial", 16, "bold"),
    bg='black',
    fg='red',
    wraplength=450
)
warning.pack(pady=20)

# Window counter
window_label = tk.Label(
    root,
    text=f"Total Windows: {window_count}",
    font=("Arial", 16, "bold"),
    bg='black',
    fg='lime'
)
window_label.pack()

# RAM usage
ram_label = tk.Label(
    root,
    text=f"RAM Usage: {get_ram_usage():.0f} MB",
    font=("Arial", 16, "bold"),
    bg='black',
    fg='cyan'
)
ram_label.pack()

# Start button
def start_mayhem():
    root.withdraw()  # Hide main window
    
    # Spawn the initial Hydra (10 of them!)
    for i in range(10):
        h = myHydra(f"ORIGINAL_{i}", depth=0)
        h.popup()
    
    # Also spawn 10 more after 1 second
    root.after(1000, lambda: [myHydra(f"INITIAL_{i}", depth=1).popup() for i in range(10)])
    
    # Start the evil background spawner
    start_evil_spawn()
    
    # Update RAM usage every second
    def update_ram():
        try:
            ram_label.config(text=f"RAM Usage: {get_ram_usage():.0f} MB")
            window_label.config(text=f"Total Windows: {window_count}")
            root.after(1000, update_ram)
        except:
            pass
    update_ram()

btn = ttk.Button(root, text="🔥 START THE HYDRA! 🔥", command=start_mayhem, style='TButton')
btn.pack(pady=20)

# Style the button
style = ttk.Style()
style.configure('TButton', font=('Arial', 14, 'bold'), background='red')

# Emergency stop button (KILL ALL)
def emergency_stop():
    try:
        # Close all toplevel windows
        for win in tk._default_root.winfo_children():
            if isinstance(win, tk.Toplevel):
                win.destroy()
        # Also kill the main window
        root.destroy()
    except:
        pass

emergency_btn = ttk.Button(root, text="🛑 EMERGENCY STOP 🛑", command=emergency_stop)
emergency_btn.pack(pady=10)

# Main loop
root.mainloop()