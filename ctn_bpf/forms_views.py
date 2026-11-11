from django.shortcuts import get_object_or_404, redirect
from django.http import HttpResponseRedirect
from django.views.generic import DetailView, DeleteView
from .models import DataSetOperation, Structure, PeriodeOk, DataSet, DSet_DElt, Operation
from .utils import basis  
from django.urls import reverse_lazy

class DetailFormulaireOp(DetailView):
    model = DataSetOperation
    context_object_name = 'dataset_fom'

    def dispatch(self, request, *args, **kwargs):
        # 1. On appelle basis() pour intercepter les redirections
        self.user_context = basis(request)
        
        if isinstance(self.user_context, HttpResponseRedirect):
            return self.user_context
            
        # CORRECTION : On transmet bien *args et **kwargs
        return super().dispatch(request, *args, **kwargs)

    def get_object(self, queryset=None):
        # Récupération sécurisée de l'objet
        return get_object_or_404(
            DataSetOperation, 
            dataset_id=self.kwargs['dataset_id'], 
            operation_id=self.kwargs['op_id']
        )

    def get_template_names(self):
        """
        Permet de choisir dynamiquement le template 
        en fonction de la valeur de count_write de l'objet récupéré.
        """
        # self.object est automatiquement disponible ici grâce à get_object()
        #if self.object and self.object.count_write > 0:
        return ['brouillon.html']
        #return ['detail-forms.html']

    def get_context_data(self, **kwargs):
        # 2. On récupère le contexte de base
        context = super().get_context_data(**kwargs)
        
        # 3. On injecte le contexte utilisateur
        context.update(self.user_context)
        
        # 4. On ajoute les éléments spécifiques
        actual_institution = context.get('actual_institution')
        structure = Structure.objects.filter(parent=None, institution=actual_institution)
        periode_ok = PeriodeOk.objects.distinct('annee')
        context['dataset'] = DataSetOperation.objects.filter(dataset_id=self.kwargs['dataset_id'],operation_id=self.kwargs['op_id'])
        context['structure'] = structure
        context['periode_ok'] = periode_ok
        context['sub_structures'] = {s.id: Structure.objects.filter(parent=s) for s in structure}

     
        
        return context


class DeleteDataset(DeleteView):
    model = DataSet
    template_name = 'dataset_confirm_delete.html'
    success_url = reverse_lazy("configurations_admin")

    def delete(self, request, *args, **kwargs):
        # 1. Récupérer l'objet DataSet que l'on s'apprête à supprimer
        self.object = self.get_object()
        
        # 2. Votre logique personnalisée (ex: vérifier ou supprimer des éléments liés)
        related_items = DSet_DElt.objects.filter(m_dataset_value=self.object)
        if related_items.exists():
            related_items.delete()  # Supprime les éléments liés avant de supprimer le dataset

        # 3. Laisser Django procéder à la suppression finale du DataSet
        return super().delete(request, *args, **kwargs)


class SaisieFormulaireOp(DetailView):
    model = DataSetOperation
    template_name = 'detail-forms.html'
    context_object_name = 'dataset_fom'

    def dispatch(self, request, *args, **kwargs):
        # 1. On appelle basis() pour intercepter les redirections
        self.user_context = basis(request)
        
        if isinstance(self.user_context, HttpResponseRedirect):
            return self.user_context
            
        # CORRECTION : On transmet bien *args et **kwargs
        return super().dispatch(request, *args, **kwargs)

    def get_object(self, queryset=None):
        # Récupération sécurisée de l'objet
        return get_object_or_404(
            DataSetOperation, 
            dataset_id=self.kwargs['dataset_id'], 
            operation_id=self.kwargs['op_id']
        )

    def get_template_names(self):
        """
        Permet de choisir dynamiquement le template 
        en fonction de la valeur de count_write de l'objet récupéré.
        """
        # self.object est automatiquement disponible ici grâce à get_object()
        #if self.object and self.object.count_write > 0:
        return ['detail-forms.html']
        #return ['detail-forms.html']

    def get_context_data(self, **kwargs):
        # 2. On récupère le contexte de base
        context = super().get_context_data(**kwargs)
        
        # 3. On injecte le contexte utilisateur
        context.update(self.user_context)
        
        # 4. On ajoute les éléments spécifiques
        actual_institution = context.get('actual_institution')
        structure = Structure.objects.filter(parent=None, institution=actual_institution)
        periode_ok = PeriodeOk.objects.distinct('annee')
        context['dataset'] = DataSetOperation.objects.filter(dataset_id=self.kwargs['dataset_id'],operation_id=self.kwargs['op_id'])
        context['structure'] = structure
        context['periode_ok'] = periode_ok
        context['sub_structures'] = {s.id: Structure.objects.filter(parent=s) for s in structure}

     
        
        return context


