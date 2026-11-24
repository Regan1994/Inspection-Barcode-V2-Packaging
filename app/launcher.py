import ctypes
import sys
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from pathlib import Path

from config import Config
from . import create_app
from .automatic_backup import TAIPEI_TZ, create_sqlite_backup, run_daily_auto_backup, verify_sqlite_file
from .single_instance import SingleInstance
from waitress import create_server, serve


def system_url():
    return f"http://{Config.BROWSER_HOST}:{Config.PORT}"


def open_browser(delay=0):
    if delay:
        time.sleep(delay)
    webbrowser.open(system_url())


def show_already_running():
    message = "TJR校機報工系統已在執行，將開啟現有系統頁面。"
    if sys.platform == "win32":
        ctypes.windll.user32.MessageBoxW(None, message, "TJR校機報工系統", 0x40)
    else:
        print(message)


def run_backup_command():
    application = create_app({"AUTO_BACKUP_ENABLED": False})
    with application.app_context():
        backup_path, created = run_daily_auto_backup(
            application.config["DATABASE"],
            application.config["BACKUP_DIRECTORY"],
            retention=application.config["AUTO_BACKUP_RETENTION"],
        )
        message = "automatic database backup created" if created else "automatic database backup already exists"
        application.logger.info("%s: %s", message, backup_path)
        print(f"{message}: {backup_path}")
    return 0


def run_verify_backup_command(path):
    verified = verify_sqlite_file(Path(path))
    print(f"backup verification passed: {verified}")
    return 0


def run_scheduled_auto_backup(application):
    """Create the daily backup without allowing a backup failure to stop serving."""
    try:
        with application.app_context():
            backup_path, created = run_daily_auto_backup(
                application.config["DATABASE"],
                application.config["BACKUP_DIRECTORY"],
                retention=application.config["AUTO_BACKUP_RETENTION"],
            )
            if created:
                application.logger.info("scheduled automatic database backup created: %s", backup_path)
    except Exception:
        application.logger.exception("scheduled automatic database backup failed")


def run_manual_backup(application):
    with application.app_context():
        now = datetime.now(TAIPEI_TZ)
        backup_path = Path(application.config["BACKUP_DIRECTORY"]) / (
            f"inspection_manual_{now:%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}.db"
        )
        return create_sqlite_backup(application.config["DATABASE"], backup_path)


def start_auto_backup_scheduler(application, stop_event=None, interval_seconds=60):
    """Check continuously so a long-running server still backs up each day."""
    if not getattr(application, "config", {}).get("AUTO_BACKUP_ENABLED"):
        return None
    stop_event = stop_event or threading.Event()

    thread = threading.Thread(
        target=auto_backup_scheduler_worker,
        args=(application, stop_event, interval_seconds),
        name="automatic-database-backup",
        daemon=True,
    )
    thread.start()
    return stop_event


def auto_backup_scheduler_worker(application, stop_event, interval_seconds):
    while not stop_event.wait(interval_seconds):
        run_scheduled_auto_backup(application)


def stop_waitress_server(server):
    """Stop accepting requests and release Waitress worker threads."""
    server.close()
    dispatcher = getattr(server, "task_dispatcher", None)
    if dispatcher is not None:
        dispatcher.shutdown()


def show_control_window(application, server):
    """Run the small desktop controller used by the windowed EXE build."""
    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.title("TJR 校機報工系統")
    root.resizable(False, False)
    root.configure(padx=24, pady=20)
    status = tk.StringVar(value=f"伺服器運行中\n{system_url()}")

    tk.Label(root, text="TJR 校機報工系統", font=("Microsoft JhengHei", 14, "bold")).pack(pady=(0, 8))
    tk.Label(root, textvariable=status, justify="center", font=("Microsoft JhengHei", 10)).pack(pady=(0, 16))
    buttons = tk.Frame(root)
    buttons.pack()

    def manual_backup():
        backup_button.config(state="disabled")
        status.set("正在建立手動備份…")

        def worker():
            try:
                backup_path = run_manual_backup(application)
                message = f"備份完成：{backup_path.name}"
            except Exception as exc:
                application.logger.exception("manual database backup failed")
                message = f"備份失敗：{exc}"
            root.after(0, lambda: (status.set(message), backup_button.config(state="normal")))

        threading.Thread(target=worker, name="manual-database-backup", daemon=True).start()

    def close_application():
        if messagebox.askyesno("關閉程式", "確定要關閉校機報工伺服器嗎？"):
            status.set("正在關閉伺服器…")
            close_button.config(state="disabled")
            backup_button.config(state="disabled")
            stop_waitress_server(server)
            root.destroy()

    backup_button = tk.Button(buttons, text="手動備份", command=manual_backup, width=12)
    backup_button.pack(side="left", padx=5)
    close_button = tk.Button(buttons, text="關閉程式", command=close_application, width=12)
    close_button.pack(side="left", padx=5)
    root.protocol("WM_DELETE_WINDOW", close_application)
    root.mainloop()


def serve_with_control_window(application):
    server = create_server(application, host=Config.HOST, port=Config.PORT, threads=Config.WAITRESS_THREADS)
    server_thread = threading.Thread(target=server.run, name="waitress-server", daemon=True)
    server_thread.start()
    try:
        show_control_window(application, server)
    finally:
        stop_waitress_server(server)
        server_thread.join(timeout=5)


def main(single_instance=None, argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--backup" in argv:
        return run_backup_command()
    if "--verify-backup" in argv:
        index = argv.index("--verify-backup")
        if index + 1 >= len(argv) or not argv[index + 1].strip():
            raise SystemExit("--verify-backup 需要指定備份檔路徑")
        return run_verify_backup_command(argv[index + 1])

    instance = single_instance or SingleInstance()
    if not instance.acquire():
        open_browser()
        show_already_running()
        return 0

    try:
        application = create_app()
        backup_scheduler_stop = start_auto_backup_scheduler(application)
        if getattr(sys, "frozen", False):
            threading.Thread(target=open_browser, kwargs={"delay": 1}, daemon=True).start()
            serve_with_control_window(application)
        else:
            serve(application, host=Config.HOST, port=Config.PORT, threads=Config.WAITRESS_THREADS)
        return 0
    finally:
        if 'backup_scheduler_stop' in locals() and backup_scheduler_stop:
            backup_scheduler_stop.set()
        instance.release()

