from django import template

register = template.Library()


@register.filter
def ar_visibles(archives, user):
    """{% with docs=sous_category.archives.all|ar_visibles:request.user %} :
    retire les documents en corbeille et ceux qu'un utilisateur n'a pas le droit de voir."""
    from ..utils import est_admin_archives
    from ..models import ArchiveFiche
    archives = list(archives)
    if not archives:
        return archives
    fiches = {f.archive_id: f for f in ArchiveFiche.objects.filter(archive_id__in=[a.pk for a in archives]).only(
        'archive_id', 'supprime_le', 'confidentialite', 'depose_par_id')}
    admin = est_admin_archives(user)
    autorises = set(user.archives_autorisees.values_list('archive_id', flat=True)) if not admin and user.is_authenticated else set()
    garde = []
    for a in archives:
        f = fiches.get(a.pk)
        if f is None:
            garde.append(a)
            continue
        if f.supprime_le:
            continue
        if admin or f.confidentialite in ('public', 'interne') or a.pk in autorises or (f.confidentialite == 'confidentiel' and f.depose_par_id == user.id):
            garde.append(a)
    return garde
