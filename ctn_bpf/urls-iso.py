
from django.urls import path, include
from . import views
from graphene_django.views import GraphQLView
urlpatterns = [
   path('drop_categorie/<int:id>/',views.drop_categorie,name="drop_categorie"),
   path('edit_categorie/<int:id>/',views.edit_categorie,name="edit_categorie"),
   path('add_souscategory/',views.add_souscategory,name="add_souscategory"),
   path('search_categorie/',views.get_categorie,name="get_categorie"),
   path('drop_sous_categorie/<int:id>/',views.drop_sous_categorie,name="drop_sous_categorie"),
   path('add_archive_operation/<int:operation_id>/',views.add_archive_operation,name="add_archive_operation"),
   path('edit_sous_categorie/<int:id>/',views.edit_sous_categorie,name="edit_sous_categorie"),
   path('edit_souscategory/<int:sous_categorie_id>/',views.edit_souscategory,name="edit_souscategory",),
   path('add_periode/',views.add_periode,name="add_periode"),
   path('get_periodeok_informations/', views.get_periodeok_informations, name='get_periodeok_informations'),
   path('recuperer_donnees_pour_graphique/<int:id>/', views.recuperer_donnees_pour_graphique, name='recuperer_donnees_pour_graphique'),

   path('add_sousactualite/',views.add_sousactualite,name="add_sousactualite"),

   path('trash_sousactualite/<int:id>/',views.trash_sousactualite,name="trash_sousactualite"),

   path('delete_Rubrique/<int:id>/',views.delete_Rubrique,name="trash_actualite"),

   path('valid_actualite/',views.valid_actualite,name="valid_actualite"),

   path('actualite/',views.actualite, name="actualite"),


   path('add_rubrique/',views.add_rubrique,name="add_rubrique"),

   path('cible/<int:id>/',views.view_cible,name="cible"),

   path('add_cible/',views.add_cible_ajax,name="add_cible_ajax"),

   path('delete_cible/<int:id>/',views.delete_cible,name="delete_cible"),

   path('update_indicateur_valeur/', views.update_indicateur_valeur, name='update_indicateur_valeur'),

   path('journalisation/',views.journalisation,name="journalisation"),


   path('stat_doc/<int:id>/',views.stat_doc,name="stat_doc"),

   path('count_views_document/<int:id>',views.count_views_document,name="count_views_document"),

   path('recuperer_periodes_par_id/',views.recuperer_periodes_par_id,name="recuperer_periodes_par_id"),

   path('recuperer_periodes/',views.recuperer_periodes,name="recuperer_periodes"),

   path('recuperer_periodes_mensuel/',views.recuperer_periodes_mensuel,name="recuperer_periodes_mensuel"),

   path('recuperer_periodes_trimestriel/',views.recuperer_periodes_trimestriel,name="recuperer_periodes_trimestriel"),

   path('recuperer_indicateurs/',views.recuperer_indicateurs,name="recuperer_indicateurs"),

   path('recuperer_nombre_consultations/',views.recuperer_nombre_consultations,name="consultation"),

   path('search_rubrique/',views.search_rubrique,name="search_rubrique"),

   path('view_actualite/<int:id>/',views.view_actualite,name="view_actualite"),

   path('mediatheque/',views.all_actuality,name="all_actuality"),

   path('institution_list/',views.institution_list,name="institution_list"),

   path('archive_operation_rapports/<int:id>/',views.archive_operation_rapports,name="archive_operation_rapports"),

   path('actualities/',views.all_actuality_site,name="all_actuality_site"),

   path('recuperer_periodes/',views.recuperer_periodes,name="recuperer_periodes"),

   path('search_period/',views.search_period,name='search_period'),
   path('add_sub_structure/',views.add_sub_structure,name="add_sub_structure"),

   path('count_informed/',views.count_informed,name="count_informed"),

   path('view_file/<int:id>',views.view_file,name="view_file"),


   path('add_baniere/',views.add_baniere,name="add_baniere"),

   path('groupe_institution/',views.groupe_institution,name="groupe_institution"),


   path('edit_group_institution/<int:id>/',views.edit_group_institution,name="edit_group_institution"),

   path('delete_group/<int:id>/',views.delete_group,name="delete_group"),

   path('delete_baners/<int:id>/',views.delete_baners,name="delete_baners"),

   path('groupe_link/<int:id>',views.groupe_link,name="groupe_link"),

   path('invoices/',views.invoices,name="invoices"),

   path('invoice_fosa/',views.invoice_fosa,name="invoice_fosa"),

   path('groupe_element/',views.groupe_element,name="groupe_element"),

   path('delete_groupe_element/<int:id>',views.delete_groupe_element,name="delete_groupe_element"),

   path('generate_pdf_district/',views.generate_pdf_district,name="generate_pdf_district"),

   path('edit_structure/<int:id>/',views.edit_structure,name="edit_structure"),

   path('delete_sub_line/<int:id>/',views.delete_sub_line,name="delete_sub_line"),

   path('presentation/<int:id>',views.presentation,name="presentation"),


   path('actualites_del/<int:id>/',views.actualites_del,name="actualites_del"),

   path('baniere_actialite/<int:id>/',views.baniere_actialite,name="baniere_actialite"),

   path('facturation/',views.facturation,name="facturation"),

   path('add_master/',views.add_master,name="add_master"),

   path('add_master/',views.add_master,name="add_master"),
   path('delete_master_groupe/<int:id>',views.delete_master_groupe,name="delete_master_groupe"),

   path('delete_master/<int:id>/',views.delete_master,name="delete_master"),

   path('add_master_element/',views.add_master_element,name="add_master_element"),

   path('add_nature/<int:id>/',views.add_nature,name="add_nature"),

   path('add_nature_operation/',views.add_nature_operation,name="add_nature_operation"),
   path('configurations_admin/',views.configurations_admin,name="configurations_admin"),

   path('activ_cat/<int:id>/',views.activ_cat,name="activ_cat"),
   path('add_categorie_operation/',views.add_categorie_operation,name="add_categorie_operation"),
   path('delete_periode/<int:id>/',views.delete_periode,name="delete_periode"),
   path('desactive_nature/<int:id>/',views.desactive_nature,name="desactive_nature"),
   path('desactive_categorie/<int:id>/',views.desactive_categorie,name="desactive_categorie"),
   path('add_periode/',views.add_periode,name="add_periode"),
   path('api_count_operations_by_nature/',views.api_count_operations_by_nature,name="api_count_operations_by_nature"),
   path('api_count_operations_by_categorie/',views.api_count_operations_by_categorie,name="api_count_operations_by_categorie"),
   path('invoice_district/',views.invoice_district,name="invoice_district"),
   path('analyse_data_indicateur/<int:id>/',views.analyse_data_indicateur,name='analyse_data_indicateur'),
   path('duplicate_dataset/<int:id>/',views.duplicate_dataset,name='duplicate_dataset'),
   path('duplicate_form/',views.duplicate_form,name='duplicate_form'),
   path('data_element/group/',views.data_element_group,name='data_element_group'),
   path('add_groupe_dataelement/',views.add_groupe_dataelement,name='add_groupe_dataelement'),
   path('add_all_group/',views.add_all_group,name='add_all_group'),
   path('indicator_group/',views.indicator_group,name='indicator_group'),
   path('add_groupe_indicateur/',views.add_groupe_indicateur,name='add_groupe_indicateur'),

   path('add_all_group_indicateur/',views.add_all_group_indicateur,name='add_all_group_indicateur'),

   path('delete_entities/<int:id>/',views.delete_entities,name='delete_entities'),
   path("graphql/", GraphQLView.as_view(graphiql=True)),
   path('add_level/',views.add_level,name='add_level'),

   path('editer-periode/<int:id>/',views.edit_periode,name='editer-periode'),

  path('edition_periode/<int:id>/',views.edition_periode,name='edition_periode'),
  path('roles_personnels/',views.roles_personnels,name='roles_personnels'),

  path('add_sou_rubrique/<int:id>/',views.add_sou_rubrique,name='add_sou_rubrique'),

  path('deleted_personnel/<int:id>/',views.deleted_personnel,name='deleted_personnel'),
  path('calculators_operations/',views.calculators_operations,name='calculators_operations'),


  path('api_count_operations/',views.api_count_operations,name='api_count_operations'),

  path('api_get_categories/',views.api_get_categories,name='api_get_categories'),

  path('edit_indicator/<int:id>/',views.edit_indicator,name='edit_indicator'),
  path('editions_indicator/<int:id>/',views.editions_indicator,name='editions_indicator'),
  path('participant/',views.template_participant,name='participant'),

  path('count_participant/',views.count_participant,name='count_participant'),

  path('affecter_operation/<int:id>/',views.affecter_operation,name='affecter_operation'),
  path('edit_role/<int:id>/',views.edit_role,name='edit_role'),
  path('delete_role/<int:id>/',views.delete_role,name='delete_role'),

  path('acticle-detail/<slug:slug>/',views.view_actuality,name='acticle-detail'),
  path('add_faq/',views.add_faq,name='add_faq'),
  path('article-connexe/<slug:slug>/',views.sousActuality,name='article-connexe'),
  
  path('objectifs/', views.objectifs, name='objectifs'),
  
  path('fonctionnalite/', views.fonctionnalite, name='fonctionnalite'),
  
  path('temoignage/', views.temoignage, name='temoignage'),

  path('active/<int:id>/',views.active,name='active'),
  
  path('institutions/', views.institutionsList, name='institutions'),

  path('inactive/<int:id>/',views.inactive,name='inactive'),

  path('api/count_process/', views.api_process, name='api-count-process'),

  path('api/process_valid/', views.api_process_valid, name='api_process_valid'),

  path('color/',views.color, name='color'),

  path('upload/entity/', views.upload_entity, name='upload-entity'),

  path('transaction/<int:id>/', views.transaction, name='transaction'),

  path('validation_transaction/', views.validation_transaction, name='validation_transaction'),

  path('search/tache/', views.search_tache, name='search-tache'),

  #path('edit_entities/<int:id>/', views.edit_entities, name='edit_entities'),

  path('add_ponderation/', views.add_ponderation, name='add_ponderation'),

  path('validation_ponderation_operation/',views.validation_ponderation_operation, name='validation_ponderation_operation'),

  path('count_transaction/', views.count_transaction, name='count_transaction'),

  path('send-transaction/<int:id>/', views.send_transaction, name='send-transaction'),

  path('save_transaction/',views.save_transaction, name='save_transaction'),

  path('api/transactions/<int:operation_id>/', views.get_transaction_data, name='transaction-data'),

  path('planification/',views.planification,name='planification'),

  path('save_source_financement/',views.save_source_financement, name='save_source_financement'),

  path('delete_source_financement/<int:id>/', views.delete_source_financement, name='delete_source_financement'),

  path('edit_source_fincement/<int:id>/', views.edit_source_fincement, name='edit_source_fincement'),

  path('update_source_financement/', views.update_source_financement, name='update_source_financement'),

  path('structure_planification/', views.structure_planification,name='structure_planification'),

  path('planification_all_operations/', views.planification_all_operations, name='planification_all_operations'),

  path('add_transaction/', views.add_transaction, name='add_transaction'),

  path('gest_dashboard_data/',views.gest_dashboard_data,name='gest_dashboard_data'),

  path('financement_budget/', views.financement_budget, name='financement_budget'),

  path('repartition_financement_budget/',views.repartition_financement_budget, name='repartition_financement_budget'),

  path('changeStatus/',views.changeStatus, name='changeStatus'),

  path('delete_etape/<int:id>/', views.delete_etape, name='delete_etape'),

  path('save_etape/',views.save_etape, name='save_etape'),

  path('search_etape/',views.search_etape,name='search_etape'),

  path('sum_duree/', views.sum_duree, name='sum_duree'),

  path('edit_structure_raci/<int:id>/', views.edit_structure_raci, name='edit_structure_raci'),

  path('technicals/',views.technicals, name='technicals'),

  path('indicator_entities/', views.indicator_entities,name='indicator_entities'),

  path('edit_cible/', views.edit_cible, name='edit_cible'),

  path('delete/operation/<int:id>/<int:id2>/', views.DeleteOperation, name='delete-operation'),

  path('search-dataelement/', views.search_dataelement, name='search-dataelement'),
  
  
  path('deleteChamp/<int:id>/', views.deleteChamp, name='deleteChamp'),
  
  path('Edit-Entity-Type/<int:id>/', views.edit_entity_type, name='Edit-Entity-Type'),
  
  path('association-collaborator/<int:id>/', views.AssociationCollaborator, name='association-collaborator'),
  
  path('team/', views.Team, name='team'),
  
  path('verify_otp_page/', views.verify_otp_page, name='verify_otp_page'),
  
  path('verify_otp/', views.verify_otp, name='verify_otp'),
  
  path('new-password/', views.NewPassword, name='new-password'),
  
  path('set_new_password/', views.set_new_password, name='set_new_password'),
  
  path('changepassword/', views.changepassword, name='change-password'),
  
  path('up_to_date_entity/', views.up_to_date_entity, name='up_to_date_entity'),
  
  path('transaction-rapport/', views.save_transaction_ajax, name='transaction-rapport'),
  path('performance_technique/', views.performance_technique, name='performance_technique'),
  path('performance-evolutive/', views.PerformanceEvolutive, name='performance_evolutive'),
  path('update-tet/', views.update_entity_performance, name='update-tet'),
  
  path('indicator-entity/',views.IndicatorEntity, name='indicator-entity'),
  
  path('delete-personnel/<int:id>/',views.delete_personnel,name='delete_personnel'),
  
  path('details-retard/', views.DetailRetard, name='details-retard'),

  path('register/', views.register, name='register'),

  path('filters_sous_categorie/', views.filters_sous_categorie, name='filters_sous_categorie'),

  path('async_tache_retard/', views.async_tache_retard, name='async_tache_retard'),

  



]