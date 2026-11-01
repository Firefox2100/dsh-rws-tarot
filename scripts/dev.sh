#!/usr/bin/env bash
# Dev instance of DSH for this plugin: its own profile (tarot-dev), its own port, detached from the shell that starts it.
# usage: scripts/dev.sh start|stop|restart|status|logs|url
set -euo pipefail

profile=tarot-dev
port=38091
root=$(cd "$(dirname "$0")/.." && pwd)
state="$root/.dev"
pidfile="$state/dsh.pid"
logfile="$state/dsh.log"
mkdir -p "$state"

running() { [[ -f $pidfile ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; }

case "${1:-status}" in
  start)
    if running; then echo "already running (pid $(cat "$pidfile")) at http://127.0.0.1:$port"; exit 0; fi
    if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "port $port is taken by another process; not starting" >&2; exit 1; fi
    mkdir -p "$state/workspace"; cd "$state/workspace"
    setsid nohup dsh --profile "$profile" --no-open --host 127.0.0.1 --port "$port" >>"$logfile" 2>&1 < /dev/null &
    echo $! >"$pidfile"
    echo "started pid $! ; log: $logfile ; url: http://127.0.0.1:$port"
    ;;
  stop)
    if running; then kill "$(cat "$pidfile")"; echo "stopped pid $(cat "$pidfile")"; else echo "not running"; fi
    rm -f "$pidfile"
    ;;
  restart) "$0" stop; sleep 1; "$0" start ;;
  status)
    if running; then echo "running pid $(cat "$pidfile") at http://127.0.0.1:$port"; else echo "not running"; fi
    ;;
  logs) tail -n "${2:-100}" -f "$logfile" ;;
  url) echo "http://127.0.0.1:$port" ;;
  *) echo "usage: $0 start|stop|restart|status|logs|url" >&2; exit 2 ;;
esac
