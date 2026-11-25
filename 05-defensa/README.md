# 05 · Defensa

Objetivo: detectar lo que hice en la fase 04 y endurecer la red real.

## Detección

- [ ] Suricata o Zeek en el server; correr un nmap desde Kali y ver si lo detecta
- [ ] OpenCanary: honeypot interno que avisa si algo escanea la LAN (no exponerlo a internet)
- [ ] CrowdSec (liviano) o Wazuh (SIEM completo, pide 4-8 GB de RAM): centralizar logs y alertas
- [ ] Usar el registro de AdGuard para detectar dominios raros o dispositivos que no conozco

Limitación: sin un switch gestionable no hay espejo de puertos. Desde el server veo su propio tráfico, y por AdGuard el DNS de todos los dispositivos.

## Hardening de la red real

Lo que aparezca en la auditoría de la fase 01. Para empezar:

- [ ] Mosquitto: autenticación y, si se puede, TLS
- [ ] Servicios escuchando en todas las interfaces que no necesitan la LAN: pasarlos a localhost o a Tailscale
- [ ] Servicios sin login (paneles, visores de logs): agregar autenticación o sacarlos de la red
- [ ] Revisar el router: puertos redirigidos, UPnP, firmware

## Qué aprendí

(completar al terminar la fase)
