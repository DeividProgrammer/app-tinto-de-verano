(in-package :delta-messenger)

;; Enable this to log delta messages on the terminal
;; (push (make-instance 'delta-logging-handler) *delta-handlers*)

(add-delta-messenger "http://delta-notifier/")

(setf *log-delta-messenger-message-bus-processing* nil)

;;;;;;;;;;;;;;;;;
;;; configuration

(in-package :client)

(setf *log-sparql-query-roundtrip* t)

(setf *backend* "http://triplestore:8890/sparql")

(in-package :server)

(setf *log-incoming-requests-p* t)

;;;;;;;;;;;;;;;;
;;; access rights (ACL)

(in-package :acl)

(defparameter *access-specifications* nil)
(defparameter *graphs* nil)
(defparameter *rights* nil)

(define-prefixes
  :mu "http://mu.semte.ch/vocabularies/core/"
  :session "http://mu.semte.ch/vocabularies/session/"
  :ext "http://mu.semte.ch/vocabularies/ext/"
  :rdf "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  :dct "http://purl.org/dc/terms/"
)

(define-graph application ("http://mu.semte.ch/application")
  (_ -> _))

(supply-allowed-group "public")

(grant (read write)
       :to application
       :for "public")
