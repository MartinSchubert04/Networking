# Networking

Aprender redes y ciberseguridad haciendo, sobre mi propio home lab. Sin switches físicos: todo lo que haga falta se arma virtual en el server.

## El lab

| Máquina | Para qué |
|---|---|
| **Server** (Debian 13, i5-10400F, 16 GB, KVM) | **Donde corro los comandos**, por SSH, para agarrarle la mano a Linux. También los labs virtuales (namespaces, containerlab, VMs). Todo lo del lab vive en `/mnt/data/lab`. |
| **Hub** (Raspberry Pi 5) | Segundo nodo real de la red para capturar y escanear "desde otro lado". |
| **Esta PC** (Windows) | **Packet Tracer** (herramienta principal para redes), Wireshark para ver las capturas del server, y las notas. |

Presupuesto de recursos en el server: 2 o 3 VMs prendidas a la vez (quedan ~9 GB de RAM libres); containerlab es liviano.

## Reglas

1. **Solo ataco cosas mías** o donde tengo permiso explícito. Nada de escanear redes ajenas.
2. **El lab va aislado de la red real.** Las máquinas vulnerables (Metasploitable, DVWA, etc.) viven en una red virtual sin salida a la LAN ni a internet.
3. **La red de casa es productiva** (AdGuard es el DNS de todos). Sobre ella solo observo y endurezco; los experimentos que rompen cosas van al lab.
4. **Capturas y escaneos de la red real no se commitean** (`capturas/` y `*.pcap` están en `.gitignore`): pueden tener tráfico y credenciales.

## Reglas para el server

El server es productivo: AdGuard es el DNS de toda la casa y también corre Home Assistant. Cosas que lo pueden romper:

| No hacer | Por qué | En su lugar |
|---|---|---|
| Tocar el firewall del host (`iptables -F`, `nft flush ruleset`, instalar `ufw`) | Docker arma sus redes con esas reglas: se caen todos los contenedores, AdGuard incluido, y la casa se queda sin DNS | Practicar firewall dentro de un namespace (`ip netns exec`) o en la VM de OPNsense |
| Cambiar IP, rutas o bajar `enp3s0` (`ip addr`, `ip route`, `ip link set ... down`) | Se corta el SSH y no hay cómo volver sin ir al server | Todos los experimentos de red, en namespaces |
| Guardar cosas en `/` | Está al 97% | Todo en `/mnt/data/lab` (94 GB libres) |
| Capturar sin límite (`tcpdump -w` sin `-c`) | Llena el disco | Limitar con `-c 1000` o `-G`/`-W`, y escribir en `/mnt/data/lab/capturas` |
| Correr con `sudo` algo copiado sin entenderlo | — | Leerlo antes con `man`, `tldr` o [explainshell](https://explainshell.com) |

Mirar es siempre seguro: `ip`, `ss`, `tcpdump`, `dig`, `docker ps`, `systemctl status`, `journalctl` no cambian nada.

## Hoja de ruta

| Fase | Tema |
|---|---|
| [01](01-fundamentos/) | Fundamentos observando mi propia red: TCP/IP, subredes, DNS, DHCP, ARP, Wireshark, nmap |
| [02](02-redes-virtuales/) | Redes con Packet Tracer (curso CCNA de Jeremy's IT Lab); después, lo mismo con Linux real |
| [03](03-firewall/) | Firewall y segmentación: OPNsense, NAT, WireGuard, Suricata |
| [04](04-ataque/) | Ataque en el lab aislado: Kali, Metasploitable, DVWA, Juice Shop |
| [05](05-defensa/) | Defensa sobre la red real: IDS, honeypot interno, hardening |
| [Código](codigo/) | Redes en Rust: eco TCP, chat, escáner, cliente DNS, lector de capturas, HTTP |

El progreso de cada fase se ve en la web (ver abajo).

El ciclo que más enseña: **atacar algo en el lab → ver cómo se ve desde el lado defensivo → arreglarlo**.

## Recursos

Todo el material (cursos, herramientas, máquinas vulnerables, Rust, homelab) está en [RECURSOS](RECURSOS.md). Para tener a mano: [comandos](referencia/comandos.md) y [subredes](referencia/subredes.md).

Certificaciones, si algún día las quiero: Network+ o CCNA → Security+ → eJPT o PNPT.

## Web

Una web local para leer todo esto y tildar los ejercicios. Los checkboxes se guardan directo en los `.md`, así que el progreso queda en git.

```powershell
.\web.cmd                 # abre http://127.0.0.1:7730
.\web.cmd --port 8000     # otro puerto
```

Solo necesita Python 3 (sin dependencias). Tiene búsqueda en todo el repo (`/` o `Ctrl+K`), índice de cada página, progreso por fase y sección, código con resaltado, y se actualiza sola si editás un `.md` en otro lado.

**Videos** (`#/videos`): el curso CCNA de Jeremy's IT Lab con su reproductor, y cualquier otra lista o video de YouTube que agregues pegando el link. Recuerda en qué video y minuto quedaste (botón *Seguir donde quedé*, y tarjeta *Seguir viendo* en el inicio). Se guarda en `progreso/`:

- `progreso/README.md`: resumen para leer de un vistazo (dónde quedé y cuánto llevo de cada lista).
- `progreso/videos.json`: posición de cada video en segundos; `current` es dónde quedé.
- `progreso/listas.json`: los videos de cada lista, en orden, con título y duración.

## Cómo está organizado

- `0X-*/README.md`: ejercicios de cada fase, con checkboxes.
- `02-redes-virtuales/labs/`: archivos de Packet Tracer y topologías reproducibles.
- `codigo/`: workspace de Cargo con un crate por proyecto.
- `referencia/`: chuletas.
- `tools/web/`: la web.
- `progreso/`: por dónde voy en los videos (lo escribe la web).
- `notas/`: lo que voy aprendiendo, con mis palabras.
- `capturas/`: pcaps locales (no se suben).
