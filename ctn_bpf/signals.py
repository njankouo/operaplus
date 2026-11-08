from django.db.models.signals import post_save
from django.dispatch import receiver
from guardian.shortcuts import assign_perm
from .models import Operation

@receiver(post_save, sender=Operation)
def set_tasks_ownership(sender, instance, created, **kwargs):
    # Liste pour stocker les utilisateurs uniques à qui attribuer les droits
    users_to_empower = set()

    # 1. Si un 'personnel' principal est assigné et a un compte utilisateur lié
    if instance.personnel and hasattr(instance.personnel, 'user') and instance.personnel.user:
        users_to_empower.add(instance.personnel.user)

    # 2. Si une personne 'accountable' (responsable RACI) est définie
    if instance.accountable and hasattr(instance.accountable, 'user') and instance.accountable.user:
        users_to_empower.add(instance.accountable.user)

    # Attribution des permissions par objet (Django Guardian)
    for user in users_to_empower:
        # Utilisez 'change_operation' et 'delete_operation' (ou ajoutez-les dans Meta.permissions)
        assign_perm('change_operation', user, instance)
        assign_perm('delete_operation', user, instance)