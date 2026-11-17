"""Nettoyage « slop » de index.html : effets décoratifs retirés, fonctionnalités intactes.
Usage : python3 nettoyer.py entree.html sortie.html  -> affiche le journal des retraits."""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
journal = []
def compte(nom, avant, apres):
    journal.append(f"{nom}: {avant}")

# 1. Globe Three.js (chargé 2 fois, 2 rendus WebGL de 3000 points chacun) + AOS jamais initialisé
blocs = re.findall(r'<script src="https://cdnjs\.cloudflare\.com/ajax/libs/three\.js/r128/three\.min\.js"></script>.*?initGlobe\);\s*\}\)\(\);\s*</script>', s, flags=re.S)
assert len(blocs) == 2, len(blocs)
for b in blocs:
    assert 'sweetalert' not in b and 'gojs' not in b and 'amcharts' not in b
    s = s.replace(b, '<!-- (retiré) globe 3D décoratif et AOS inutilisé : allège la page -->', 1)
journal.append(f"globe Three.js + AOS : {len(blocs)} blocs retirés")
n = s.count('<div id="canvas-wrapper"></div>'); s = s.replace('<div id="canvas-wrapper"></div>', ''); journal.append(f"canvas-wrapper : {n}")

# 2. Règles CSS mortes (classes jamais utilisées) : .bg-pro-gradient, .glass-card, .loader-pulse, .modal-content
morts = [
 r'\s*/\* Gradient animé pour le header \*/\s*\.bg-pro-gradient \{[^}]*\}',
 r'\s*/\* Effet "Glassmorphism" au survol \*/\s*\.glass-card \{[^}]*\}\s*\.glass-card:hover \{[^}]*\}',
 r'\s*/\* Animation de pulsation \*/\s*@keyframes pulse-ring \{(?:[^{}]*\{[^}]*\})*\s*\}\s*\.loader-pulse \{[^}]*\}',
 r'/\* L\'élément interne \(la boîte de dialogue\) \*/\s*#modalMenu \.modal-content \{[^}]*\}\s*/\*[^*]*\*/\s*#modalMenu\.hidden \.modal-content \{[^}]*\}\s*/\*[^*]*\*/\s*#modalMenu:not\(\.hidden\) \.modal-content \{[^}]*\}',
]
for m in morts:
    s, k = re.subn(m, '', s, count=1); assert k == 1, m[:40]
journal.append("CSS mort : 4 groupes de règles")

# 3. Éléments purement décoratifs : faux paquet de cartes, halo flou, voiles dégradés, points « ping »
deco = [
 (r'\n[ \t]*<div class="absolute -bottom-6 left-6 right-6 h-full[^"]*"[^>]*></div>', 'carte fantôme arrière (1)'),
 (r'\n[ \t]*<div class="absolute -bottom-3 left-3 right-3 h-full[^"]*"[^>]*></div>', 'carte fantôme arrière (2)'),
 (r'\n[ \t]*<div class="absolute [^"]*blur-3xl[^"]*"></div>', 'halo flou'),
 (r'\n[ \t]*<div class="absolute inset-0 bg-gradient-to-[^"]*pointer-events-none[^"]*"></div>', 'voile dégradé'),
 (r'\n[ \t]*<span class="animate-ping[^"]*"></span>', 'point « ping »'),
]
for rx, nom in deco:
    s, k = re.subn(rx, '', s); journal.append(f"{nom} : {k}")

# 4. Classes d'effet retirées des attributs class (aucun id / nom / variable touché)
def nettoie_classes(m):
    cl = m.group(1).split()
    garde = [c for c in cl if not (
        re.fullmatch(r'(?:[\w/-]+:)*shadow-\[0_0_[^\]]*\]', c)            # halos lumineux
        or re.fullmatch(r'(?:[\w/-]+:)*drop-shadow(?:-\w+)?', c)
        or re.fullmatch(r'(?:[\w/-]+:)*shadow-(?:amber|indigo|blue|emerald|violet|purple|teal|rose|red|orange)-\d+/\d+', c)  # ombres colorées
        or re.fullmatch(r'(?:hover|group-hover|group-hover/[\w-]+):scale-\d+', c)   # zooms au survol
        or c == 'shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
        or c == 'animate-pulse'
    )]
    if len(garde) != len(cl): nettoie_classes.n += len(cl) - len(garde)
    return 'class="' + ' '.join(garde) + '"'
nettoie_classes.n = 0
s = re.sub(r'class="([^"{}]*)"', nettoie_classes, s)
journal.append(f"classes d'effet retirées : {nettoie_classes.n}")

# 5. Coquille : « </div>> » affichait un « > » parasite à l'écran
k = s.count('</div>>'); s = s.replace('</div>>', '</div>'); journal.append(f"coquille </div>> : {k}")


# 6. Bogue : ce script redéclarait « const modal » déjà déclaré plus haut -> tout le bloc plantait
#    (jauges RACI non dessinées). On l'enferme dans une portée locale ; aucun nom changé.
i = s.find('// Options globales partagées pour les jauges sombres'); assert i > 0
a = s.rfind('<script>', 0, i); b = s.find('</script>', i)
bloc = s[a + len('<script>'):b]; assert 'const modal' in bloc
s = s[:a] + '<script>\ntry { /* portée locale (correctif) : évite le conflit avec « const modal » déclaré ailleurs */' + bloc + '} catch (e) { /* jauges absentes de cette page */ }\n' + s[b:]
journal.append("bloc des jauges RACI : remis en marche (conflit « const modal »)")

open(dst, 'w', encoding='utf-8').write(s)
print('\n'.join(journal))
