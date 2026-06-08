import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAllDocuments, 
  createDocument as createDoc, 
  updateDocument as updateDoc, 
  deleteDocument as deleteDoc,
  type LocalDocument 
} from "@/lib/indexeddb";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: getAllDocuments,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { title: string; content: string; fileType?: string; source?: string; pdfData?: ArrayBuffer }) => {
      return createDoc(data.title, data.content, data.fileType, data.source, data.pdfData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      return updateDoc(id, title, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return deleteDoc(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
