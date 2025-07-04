import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import LinkList from "../components/LinkList";

export default function Dashboard({ nomeUsuario, onLogout }) {
  const [links, setLinks] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editingLink, setEditingLink] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [userId, setUserId] = useState(localStorage.getItem("user_id"));
  const API_URL = "https://project4-2025a-giulia-vitoria.onrender.com";

  const [folders, setFolders] = useState(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Captura usuário GitHub e obtém user_id
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const username = params.get("username");

    if (userId) return;

    if (username) {
      localStorage.setItem("github_username", username);

      fetch(`${API_URL}/users/github/${username}`)
        .then((res) => {
          if (!res.ok) throw new Error("Usuário GitHub não encontrado");
          return res.json();
        })
        .then((data) => {
          localStorage.setItem("user_id", data.id);
          setUserId(data.id);
          navigate("/dashboard", { replace: true });
        })
        .catch((err) => {
          console.error(err);
          navigate("/login", { replace: true });
        });
    } else {
      navigate("/login", { replace: true });
    }
  }, [location.search, navigate, userId]);

  // Busca os links (useCallback para não ser recriada toda hora)
  const fetchLinks = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = selectedFolder
        ? `${API_URL}/bookmarks?user_id=${userId}&folder_id=${selectedFolder}`
        : `${API_URL}/bookmarks?user_id=${userId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao buscar links");

      const data = await res.json();
      const formattedLinks = data.map((link) => ({
        id: link.id,
        title: link.titulo,
        url: link.url,
        description: link.descricao || "",
        folderId: Number(link.folder_id),
      }));

      setLinks(formattedLinks);
    } catch (error) {
      console.error("Erro ao carregar links:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedFolder]);

  // Chama fetchLinks quando userId ou selectedFolder mudam
  useEffect(() => {
    if (userId) {
      fetchLinks();
    }
  }, [userId, selectedFolder, fetchLinks]);

  // Busca as pastas do usuário
  const fetchFolders = useCallback(async (uid) => {
    try {
      setIsLoadingFolders(true);
      const response = await fetch(`${API_URL}/folders?user_id=${uid}`);
      if (!response.ok) throw new Error("Erro ao buscar pastas");
      const folders = await response.json();
      setFolders(folders);
    } catch (error) {
      console.error(error.message);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);
  
  // Chama fetchFolders ao montar o componente ou userId mudar
  useEffect(() => {
    if (userId) {
      fetchFolders(userId);
    }
  }, [userId, fetchFolders]);

  const filteredLinks = (links || []).filter((link) => {
    const matchesSearch =
      !searchTerm ||
      link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (link.description &&
        link.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFolder = selectedFolder
      ? Number(link.folderId) === Number(selectedFolder)
      : true;

    return matchesSearch && matchesFolder;
  });

  async function fetchSuggestion() {
    try {
      setLoadingSuggestion(true);

      const contexto = links.map((link) => ({
        title: link.title,
        description: link.description,
        url: link.url,
      }));

      const res = await fetch(`${API_URL}/suggest_bookmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, contexto }),
      });

      const data = await res.json();
      if (res.ok) {
        setLinks((prev) => [
          {
            id: data.id,
            title: data.title,
            url: data.url,
            description: data.description,
            folderId: null,
          },
          ...prev,
        ]);
      } else {
        alert("Erro ao sugerir: " + data.erro);
      }
    } catch (err) {
      alert("Erro ao buscar sugestão: " + err.message);
    } finally {
      setLoadingSuggestion(false);
    }
  }


  const handleAddLink = async (e) => {
    e.preventDefault();
    setErro("");
    setIsLoading(true);
    if (!newTitle || !newUrl) {
      alert("Título e URL são obrigatórios!");
      setIsLoading(false);
      return;
    }
    const newLinkData = {
      user_id: parseInt(userId),
      titulo: newTitle,
      url: newUrl,
      descricao: newDescription,
      folder_id: selectedFolder,
    };
    try {
      const res = await fetch(`${API_URL}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLinkData),
      });
      const result = await res.json();
      setLinks([
        {
          id: result.id,
          title: result.titulo,
          url: result.url,
          description: result.descricao,
          folderId: result.folder_id,
        },
        ...links,
      ]);
      setNewTitle("");
      setNewUrl("");
      setNewDescription("");
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  function handleEdit(link) {
    setEditingLink({
      id: link.id,
      titulo: link.title,
      url: link.url,
      descricao: link.description || "",
    });
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    setErro("");
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/bookmarks/${editingLink.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: editingLink.titulo,
          url: editingLink.url,
          descricao: editingLink.descricao,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar link");
      setLinks(
        links.map((l) =>
          l.id === editingLink.id
            ? {
                ...l,
                title: editingLink.titulo,
                url: editingLink.url,
                description: editingLink.descricao,
              }
            : l
        )
      );
      setEditingLink(null);
    } catch (error) {
      setErro(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id);
    await fetch(`${API_URL}/bookmarks/${id}`, { method: "DELETE" });
    setLinks(links.filter((link) => link.id !== id));
    setFavorites(favorites.filter((fav) => fav.id !== id));
    setDeletingId(null);
    setShowConfirm(false);
    setConfirmDeleteId(null);
  };

  const confirmDelete = (id) => {
    setConfirmDeleteId(id);
    setShowConfirm(true);
  };

  return (
    <div style={styles.container}>
      <Header
        onSearch={setSearchTerm}
        nomeUsuario={nomeUsuario}
        onLogout={onLogout}
      />
      <div style={styles.main}>
        <Sidebar
          folders={folders}
          isLoading={isLoadingFolders}
          selectedFolder={selectedFolder}
          setSelectedFolder={setSelectedFolder}
          onCreateFolder={(newFolder) =>
            setFolders((prev) => [...prev, newFolder])
          }
          onDeleteFolder={(id) =>
            setFolders((prev) => prev.filter((f) => f.id !== id))
          }
          onEditFolder={(id, name) =>
            setFolders((prev) =>
              prev.map((f) => (f.id === id ? { ...f, name } : f))
            )
          }
        />
        <main style={styles.content}>
          <form onSubmit={handleAddLink} style={styles.form}>
            <input
              type="text"
              placeholder="Título"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="url"
              placeholder="URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              style={styles.input}
            />
            {erro && <span style={styles.erro}>{erro}</span>}

            <button type="submit" style={styles.button} disabled={isLoading}>
              {isLoading ? <div style={styles.loader}></div> : "Adicionar Link"}
            </button>

            <button onClick={fetchSuggestion} style={styles.button} disabled={loadingSuggestion}>
              {loadingSuggestion ? <div style={styles.loader}></div> : "Sugestão da IA"}
            </button>
          </form>

          {editingLink && (
            <form onSubmit={salvarEdicao} style={styles.form}>
              <input
                type="text"
                value={editingLink.titulo}
                onChange={(e) => setEditingLink({ ...editingLink, titulo: e.target.value })}
                style={styles.input}
                required
              />
              <input
                type="url"
                value={editingLink.url}
                onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                style={styles.input}
                required
              />
              <input
                type="text"
                value={editingLink.descricao || ""}
                onChange={(e) => setEditingLink({ ...editingLink, descricao: e.target.value })}
                style={styles.input}
              />
              {erro && <span style={styles.erro}>{erro}</span>}
              <button type="submit" style={styles.button} disabled={isSaving}>
                {isSaving ? <div style={styles.loader}></div> : "Salvar"}
              </button>
              <button type="button" onClick={() => setEditingLink(null)} style={{ ...styles.button, backgroundColor: "gray" }}>
                Cancelar
              </button>
            </form>
          )}

          {showConfirm && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <p>Tem certeza que deseja excluir este link?</p>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    onClick={() => handleDelete(confirmDeleteId)}
                    style={{ ...styles.button, backgroundColor: "#2c3e50" }}
                  >
                    {deletingId === confirmDeleteId ? (
                      <div style={styles.loader}></div>
                    ) : (
                      "Sim, excluir"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirm(false);
                      setConfirmDeleteId(null);
                    }}
                    style={{ ...styles.button, backgroundColor: "gray" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <LinkList
            links={filteredLinks}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={confirmDelete}
            grid
          />
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: { height: "100vh", display: "flex", flexDirection: "column" },
  main: { flex: 1, display: "flex" },
  content: { flex: 1, padding: "20px", background: "#e9ebee", overflowY: "auto" },
  form: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "20px",
    alignItems: "center",
  },
  input: {
    flex: "1 1 150px",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "14px",
    minWidth: "150px",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "6px",
    backgroundColor: "#2c3e50",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    marginBottom: "10px",
  },
  erro: { color: "red", fontSize: "14px" },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modal: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    minWidth: "300px",
  },
  loader: {
    width: "24px",
    height: "24px",
    border: "4px solid rgba(255, 255, 255, 0.3)",
    borderTop: "4px solid white",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
};
