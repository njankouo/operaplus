"""Supprime les doublons de saisie dans ctn_bpf.DSet_DElt, avant de poser la contrainte d'unicité.

Un doublon = plusieurs lignes de SAISIE MANUELLE (comment vide) pour le même
élément de données, la même unité et la même période.

Règle de conservation, par groupe :
    1. la ligne la plus récente qui porte une valeur (nombre, texte, date, pièce jointe ou N/A) ;
    2. à défaut, la ligne la plus récente.
Les autres lignes sont sauvegardées dans un CSV, puis supprimées.

Usage :
    python manage.py dedoublonner_saisies                 # simulation : rien n'est modifié
    python manage.py dedoublonner_saisies --appliquer     # nettoie (sauvegarde CSV d'abord)
    python manage.py dedoublonner_saisies --appliquer --auto   # traite aussi les cumuls automatiques identiques
"""
import csv
import os

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone

CLE = ('m_dataelement_id', 'm_structure_id', 'periode_id')


class Command(BaseCommand):
    help = "Repère et supprime les doublons de saisie (DSet_DElt) en gardant la bonne valeur."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Modifie la base (sinon simple simulation).')
        parser.add_argument('--auto', action='store_true', help='Dédoublonne aussi les cumuls automatiques au commentaire identique.')
        parser.add_argument('--sauvegarde', default='', help='Chemin du CSV des lignes supprimées.')

    def handle(self, *args, **o):
        M = apps.get_model('ctn_bpf', 'DSet_DElt')
        noms = {f.name for f in M._meta.concrete_fields}
        attn = [f.attname for f in M._meta.concrete_fields]
        valeur = [c for c in ('m_value', 'texte_element', 'date_element', 'fichier_element') if c in noms]
        appliquer = o['appliquer']
        self.stdout.write(self.style.WARNING('SIMULATION : rien ne sera modifié (ajoutez --appliquer).') if not appliquer else 'Nettoyage en cours…')

        # 0. commentaire vide ('' ou espaces) = saisie manuelle : on le ramène à NULL, sinon la contrainte ne le verrait pas
        vides = M.objects.filter(comment__regex=r'^\s*$')
        nb_vides = vides.count()
        self.stdout.write(f'Saisies manuelles avec commentaire vide au lieu de NULL : {nb_vides}')

        def a_une_valeur(x):
            return bool(getattr(x, 'est_na', False)) or any(getattr(x, c + ('_id' if c == 'fichier_element' else ''), None) not in (None, '') for c in valeur)

        def groupes(qs, cle):
            return (qs.filter(**{c.replace('_id', '') + '__isnull': False for c in CLE})
                      .values(*cle).annotate(n=Count('id')).filter(n__gt=1))

        a_supprimer, resume = [], []
        manuelles = M.objects.filter(Q(comment__isnull=True) | Q(comment__regex=r'^\s*$'))
        for g in groupes(manuelles, CLE):
            lignes = list(manuelles.filter(**{c: g[c] for c in CLE}).order_by(F('date_saisie').desc(nulls_last=True), '-id') if 'date_saisie' in noms
                          else manuelles.filter(**{c: g[c] for c in CLE}).order_by('-id'))
            garde = next((x for x in lignes if a_une_valeur(x)), lignes[0])
            autres = [x for x in lignes if x.pk != garde.pk]
            a_supprimer += autres
            resume.append((g, garde, autres))
        nb_auto = 0
        if o['auto']:
            auto = M.objects.exclude(Q(comment__isnull=True) | Q(comment__regex=r'^\s*$'))
            for g in groupes(auto, CLE + ('comment',)):
                lignes = list(auto.filter(**{c: g[c] for c in CLE + ('comment',)}).order_by('-id'))
                a_supprimer += lignes[1:]; nb_auto += len(lignes) - 1

        self.stdout.write(f'Groupes de saisies manuelles en double : {len(resume)}  ·  lignes à supprimer : {len(a_supprimer) - nb_auto}'
                          + (f'  ·  cumuls automatiques en double : {nb_auto}' if o['auto'] else ''))
        for g, garde, autres in resume[:15]:
            self.stdout.write(f"  élément {g['m_dataelement_id']} · unité {g['m_structure_id']} · période {g['periode_id']} : "
                              f"{g['n']} lignes → on garde #{garde.pk}, on retire {', '.join('#' + str(x.pk) for x in autres)}")
        if len(resume) > 15:
            self.stdout.write(f'  … et {len(resume) - 15} autre(s) groupe(s).')

        if not appliquer:
            self.stdout.write(self.style.SUCCESS('Simulation terminée.'))
            return
        if a_supprimer:
            chemin = o['sauvegarde'] or os.path.join(settings.BASE_DIR, 'sauvegardes', f'doublons_dset_delt_{timezone.now():%Y%m%d_%H%M%S}.csv')
            chemin = os.path.abspath(chemin); os.makedirs(os.path.dirname(chemin), exist_ok=True)
            with open(chemin, 'w', newline='', encoding='utf-8') as fh:
                w = csv.writer(fh); w.writerow(attn)
                for x in a_supprimer:
                    w.writerow([getattr(x, a) for a in attn])
            self.stdout.write(f'Sauvegarde des lignes supprimées : {chemin}')
        with transaction.atomic():
            n_vides = vides.update(comment=None)
            n_supp = M.objects.filter(pk__in=[x.pk for x in a_supprimer]).delete()[0] if a_supprimer else 0
        self.stdout.write(self.style.SUCCESS(f'Terminé : {n_vides} commentaire(s) vide(s) remis à NULL, {n_supp} doublon(s) supprimé(s).'))
        restants = groupes(M.objects.filter(comment__isnull=True), CLE).count()
        if restants:
            self.stdout.write(self.style.ERROR(f'Il reste {restants} groupe(s) en double : relancez la commande.'))
        else:
            self.stdout.write('Vous pouvez maintenant ajouter la contrainte d’unicité au modèle et lancer makemigrations / migrate.')
