Sito web della Polisportiva San Donato a Torino. 

Strutura dei component (in ordine per route e per apparizione nella pagina)


- Generali: 
    - TopHeader
    - Hero
    - MyNavbar

- Route /
    - HomePage : suddiviso in:
            > AboutSection: carosello con immagini (definito in Home)
            > NewsList: mostra il component NewsList TODO: deve mostrare le 4 più recenti notizie

- Route /news
    - NewsPage : 
            > mostra una sidebar con i filtri per sport e per data (nota: le checkbox si aggiornano in base alle variabili 'sport' e 'author' degli oggetti "news")
            > NewsList: mostra tutte le notizie presenti nel db

- Route /news/:id
    - NewsDetail: mostra i dettagli relativi alla notizia

- Route /sports

- Route /modulistica-tariffe

- Route /iscrizione-rinnovo

- Route /sponsor

- Route /chi-siamo

- Route /contatti

- Route /privacy

- Route /tutela-minori

- Route /cinquepermille

- Route /contributi-pubblici

